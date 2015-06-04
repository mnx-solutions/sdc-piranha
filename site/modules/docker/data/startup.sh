#! /bin/bash

if [ -e /var/tmp/.docker-installed ]; then 
    exit 0 
fi
exec 3>&1 4>&2 1>/var/log/docker-install.log 2>&1
set -x

/usr/sbin/mdata-get private-key > /root/.ssh/user_id_rsa
/usr/sbin/mdata-get public-key > /root/.ssh/user_id_rsa.pub
DISABLE_TLS=$(/usr/sbin/mdata-get disable-tls)
MANTA_URL=$(/usr/sbin/mdata-get manta-url)
MANTA_KEY_ID=$(ssh-keygen -lf /root/.ssh/user_id_rsa.pub | awk '{print $2}')
MANTA_USER=$(/usr/sbin/mdata-get manta-account)
MANTA_SUBUSER=$(/usr/sbin/mdata-get manta-subuser)
DOCKER_VERSION=$(/usr/sbin/mdata-get docker-version)

DOCKER_INTERNAL_PORT=54243
REGISTRY_INTERNAL_PORT=5000
DOCKER_PORT=4243
DOCKER_TCP_PORT=4240
REGISTRY_PORT=5000
MEMSTAT_PORT=8888

DOCKER_VERSION="${DOCKER_VERSION:-1.6.0}"

KEYS_PATH=/root/.docker
MANTA_DOCKER_PATH=/${MANTA_USER}/stor/.joyent/docker
DOCKER_DIR=/mnt/docker
LOGS_DIR=/mnt/manta
IP_ADDRESSES=$(ip a s | grep 'inet ' | awk '{print $2}' | grep -v 127.0.0.1 | awk -F/ '{print $1}')

if [ ! -e ${KEYS_PATH} ];then
    mkdir -p ${KEYS_PATH}
fi
mdata-get ca > ${KEYS_PATH}/ca.pem
mdata-get server-key > ${KEYS_PATH}/server-key.pem
mdata-get server-cert > ${KEYS_PATH}/server-cert.pem

for key in $(echo "user-script private-key public-key manta-account manta-url disable-tls ca server-key server-cert");do
    /usr/sbin/mdata-delete ${key} &
done


function manta {
    local alg=rsa-sha256
    local keyId=/${MANTA_USER}/${MANTA_SUBUSER}/keys/${MANTA_KEY_ID}
    local now=$(LC_ALL=C date -u "+%a, %d %h %Y %H:%M:%S GMT")
    local sig=$(echo "date:" ${now} | \
                tr -d '\n' | \
                openssl dgst -sha256 -sign /root/.ssh/user_id_rsa | \
                openssl enc -e -a | tr -d '\n')

    curl -sS ${MANTA_URL}"$@" -H "date: $now"  \
        -H "Authorization: Signature keyId=\"$keyId\",algorithm=\"$alg\",signature=\"$sig\""
}

manta ${MANTA_DOCKER_PATH}/logs -X PUT -H "content-type: application/json; type=directory"
manta ${MANTA_DOCKER_PATH}/logs/$(hostname) -X PUT -H "content-type: application/json; type=directory"

function writeStage {
    manta ${MANTA_DOCKER_PATH}/.status-$(hostname) -XPUT -d"{\"status\": \"$1\"}"
}

function installDocker {
    wget -c https://get.docker.com/ubuntu/pool/main/l/lxc-docker-${DOCKER_VERSION}/lxc-docker-${DOCKER_VERSION}_${DOCKER_VERSION}_amd64.deb
    dpkg -i lxc-docker-${DOCKER_VERSION}_${DOCKER_VERSION}_amd64.deb
    local STATE=true
    while ${STATE} ; do
        if pgrep mkfs.ext3  >/dev/null; then
            echo "waiting for mkfs to complete"
        else
            STATE=false
        fi
        sleep 6
    done
    umount -f /mnt
    mkfs.ext4 $(grep '/mnt' /etc/fstab | awk '{print $1}')
    mount -a
    mkdir ${DOCKER_DIR}
    service docker stop
    echo "DOCKER_OPTS=\"-g /mnt/docker -H tcp://127.0.0.1:${DOCKER_INTERNAL_PORT} -H unix:///var/run/docker.sock --api-enable-cors=true\"" >> /etc/default/docker
    service docker start
}

function createBalancer {
    cat ${KEYS_PATH}/server-cert.pem ${KEYS_PATH}/server-key.pem >${KEYS_PATH}/server.pem
    wget -c http://joyent.archive.ubuntu.com/ubuntu/pool/main/h/haproxy/haproxy_1.5.10-1_amd64.deb
    wget -c http://joyent.archive.ubuntu.com/ubuntu/pool/main/i/init-system-helpers/init-system-helpers_1.20ubuntu3_all.deb
    dpkg -i init-system-helpers_1.20ubuntu3_all.deb haproxy_1.5.10-1_amd64.deb

    cat <<END >>/etc/haproxy/haproxy.cfg

frontend registry
$(for ip in ${IP_ADDRESSES};do echo "    bind ${ip}:${REGISTRY_PORT} ssl crt /root/.docker/server.pem ca-file /root/.docker/ca.pem verify required";done)
    default_backend registry_back

frontend docker
    bind 0.0.0.0:${DOCKER_PORT} ssl crt /root/.docker/server.pem ca-file /root/.docker/ca.pem verify required
    acl is_memstat url_beg /memStat/
    use_backend memstat_back if is_memstat
    default_backend docker_back

frontend docker_tcp
    bind 0.0.0.0:${DOCKER_TCP_PORT} ssl crt /root/.docker/server.pem ca-file /root/.docker/ca.pem verify required
    mode tcp
    option tcplog
    default_backend docker_back_tcp

backend registry_back
    mode http
    server r 127.0.0.1:${REGISTRY_INTERNAL_PORT}

backend docker_back_tcp
    mode tcp
    option tcplog
    server d 127.0.0.1:${DOCKER_INTERNAL_PORT}

backend docker_back
    mode http
    server d 127.0.0.1:${DOCKER_INTERNAL_PORT}

backend memstat_back
    mode http
    reqrep ^([^\ :]*)\ /memStat/(.*) \1\ /\2
    server m 127.0.0.1:${MEMSTAT_PORT}

END
    /etc/init.d/haproxy restart
}

function installLogRotator {
    mkdir -p ${LOGS_DIR}
    cat <<END > /etc/logrotate.d/docker-containers
${DOCKER_DIR}/containers/*/*json.log {
    #rotate 10000
    size 10k
    copytruncate
    olddir ${LOGS_DIR}
    missingok
    notifempty
    sharedscripts
    postrotate
        manta() {
            alg=rsa-sha256
            keyId=/${MANTA_USER}/${MANTA_SUBUSER}/keys/${MANTA_KEY_ID}
            now=\$(LC_ALL=C date -u "+%a, %d %h %Y %H:%M:%S GMT")
            sig=\$(echo "date:" \${now} | \\
                        tr -d '\\n' | \\
                        openssl dgst -sha256 -sign /root/.ssh/user_id_rsa | \\
                        openssl enc -e -a | tr -d '\\n')
        
            curl -sS ${MANTA_URL}"\$@" -H "date: \${now}"  \\
                -H "Authorization: Signature keyId=\"\${keyId}\",algorithm=\"\${alg}\",signature=\"\${sig}\""
        }

        for f in \$(find ${LOGS_DIR} -type f ! -name '*-last.log');do
            ContainerId=\$(basename \${f} | awk -F- '{print \$1}')
            ContainerLogPath=${MANTA_DOCKER_PATH}/logs/\$(hostname)/\${ContainerId}
            manta \${ContainerLogPath} -XPUT -H "content-type: application/json; type=directory"
            manta \${ContainerLogPath}/\$(date +"%F").log -XPUT -T \${f}
            mv \${f} ${LOGS_DIR}/\${ContainerId}-last.log
        done
    endscript 
}
END
    wget -c http://joyent.archive.ubuntu.com/ubuntu/pool/main/l/logrotate/logrotate_3.8.7-1ubuntu1_amd64.deb
    dpkg -i logrotate_3.8.7-1ubuntu1_amd64.deb
}

function installMemStat {
    mkdir /opt/memStat

    cat <<END >/opt/memStat/getMemoryUsage.sh
#! /bin/bash
free | grep Mem | awk '{print \$3/\$2 * 100.0}'
END

    cat <<END >/opt/memStat/getCpuUsage.sh
#! /bin/bash
top -b -n2 | grep 'Cpu(s)'|tail -n 1 | awk '{print \$2 + \$4}'
END

    cat <<END >/opt/memStat/memStat.py
import subprocess
import BaseHTTPServer

class MyHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def do_GET(s):
        s.send_response(200)
        s.send_header("Content-type", "application/json")
        s.end_headers()
        cpuUsage = subprocess.check_output("/opt/memStat/getCpuUsage.sh")
        memoryUsage = subprocess.check_output("/opt/memStat/getMemoryUsage.sh")
        s.wfile.write('{"memoryUsage":' + memoryUsage + ', "cpuUsage": ' + cpuUsage + '}')

server_class = BaseHTTPServer.HTTPServer
httpd = server_class(('127.0.0.1', ${MEMSTAT_PORT}), MyHandler)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
httpd.server_close()
END

    chmod 777 /opt/memStat/getMemoryUsage.sh
    chmod 777 /opt/memStat/getCpuUsage.sh

    sed -i -e '$i python /opt/memStat/memStat.py &\n' /etc/rc.local

    python /opt/memStat/memStat.py &
}

writeStage "installing docker"
installDocker

writeStage "setting up API"
createBalancer

writeStage "installing log rotator"
installLogRotator

writeStage "installing memStat"
installMemStat

touch /var/tmp/.docker-installed
sleep 5;

writeStage "completed"