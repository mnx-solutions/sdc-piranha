#! /bin/bash

if [ -e /var/tmp/.docker-installed ]; then
    exit 0
fi
exec 3>&1 4>&2 1>/var/log/docker-install.log 2>&1
set -x

cat <<'END' >/root/.ssh/user_id_rsa
%__private-key__%
END

cat <<'END' >/root/.ssh/user_id_rsa.pub
%__public-key__%
END


DISABLE_TLS=%__disable-tls__%
WITHOUT_MANTA=&__disable-manta__%
MANTA_URL=%__manta-url__%
MANTA_KEY_ID=$(ssh-keygen -lf /root/.ssh/user_id_rsa.pub | awk '{print $2}')
MANTA_USER=%__manta-account__%
MANTA_SUBUSER=%__manta-subuser__%
DOCKER_VERSION=$(/usr/sbin/mdata-get docker-version)
MANTA_DEV_ACCOUNT=dbqp
DEP_URL="https://us-east.manta.joyent.com/${MANTA_DEV_ACCOUNT}/public/docker"

DOCKER_INTERNAL_PORT=54243
REGISTRY_INTERNAL_PORT=$(printenv REGISTRY_PORT)
DOCKER_PORT=4243
DOCKER_TCP_PORT=4240
MEMSTAT_PORT=8888

DOCKER_VERSION="${DOCKER_VERSION:-1.8.1}"

KEYS_PATH=/root/.docker
MANTA_DOCKER_PATH=/${MANTA_USER}/stor/.joyent/docker
DOCKER_DIR=/mnt/docker
LOGS_DIR=/mnt/manta
IP_ADDRESSES=$(ip a s | grep 'inet ' | awk '{print $2}' | grep -v 127.0.0.1 | awk -F/ '{print $1}')

if [ ! -e ${KEYS_PATH} ];then
    mkdir -p ${KEYS_PATH}
fi
cat <<'END' >${KEYS_PATH}/ca.pem
%__ca__%
END

cat <<'END' >${KEYS_PATH}/server-key.pem
%__server-key__%
END

cat <<'END' >${KEYS_PATH}/server-cert.pem
%__server-cert__%
END

/usr/sbin/mdata-delete user-script &

function manta {
    if [ ! -z "${WITHOUT_MANTA}" ];then
        return
    fi

    local alg=rsa-sha256
    local user="/${MANTA_USER}"
    if [ ! -z ${MANTA_SUBUSER} ]; then
        user="${user}/${MANTA_SUBUSER}"
    fi
    local keyId=${user}/keys/${MANTA_KEY_ID}
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
    LINUX_IMAGE_VERSION="$(uname -r)_$(uname -r | sed 's/-generic$//').$(uname -v | awk -F- '{print substr($1, 2)}')"
    wget -c "${DEP_URL}/libnl-3-200_3.2.21-1_amd64.deb"
    wget -c "${DEP_URL}/libnl-genl-3-200_3.2.21-1_amd64.deb"
    wget -c "${DEP_URL}/wireless-regdb_2013.02.13-1ubuntu1_all.deb"
    wget -c "${DEP_URL}/crda_1.1.2-1ubuntu2_amd64.deb"
    wget -c "${DEP_URL}/iw_3.4-1_amd64.deb"
    wget -c "http://joyent.archive.ubuntu.com/ubuntu/pool/main/l/linux/linux-image-extra-${LINUX_IMAGE_VERSION}_amd64.deb"
    wget -c "https://apt.dockerproject.org/repo/pool/main/d/docker-engine/docker-engine_${DOCKER_VERSION}-0~$(lsb_release -sc)_amd64.deb"
    wget -c "${DEP_URL}/aufs-tools_3.2+20130722-1.1_amd64.deb"

    dpkg -i libnl-3-200_3.2.21-1_amd64.deb libnl-genl-3-200_3.2.21-1_amd64.deb wireless-regdb_2013.02.13-1ubuntu1_all.deb \
        crda_1.1.2-1ubuntu2_amd64.deb iw_3.4-1_amd64.deb linux-image-extra-${LINUX_IMAGE_VERSION}_amd64.deb \
        aufs-tools_3.2+20130722-1.1_amd64.deb docker-engine_${DOCKER_VERSION}-0~$(lsb_release -sc)_amd64.deb

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
    echo "DOCKER_OPTS=\"-s aufs -g /mnt/docker -H tcp://127.0.0.1:${DOCKER_INTERNAL_PORT} -H unix:///var/run/docker.sock\"" >> /etc/default/docker
    service docker start
}

function createBalancer {
    cat ${KEYS_PATH}/server-cert.pem ${KEYS_PATH}/server-key.pem >${KEYS_PATH}/server.pem
    wget -c "${DEP_URL}/haproxy_1.5.10-1_amd64.deb"
    wget -c "${DEP_URL}/init-system-helpers_1.20ubuntu3_all.deb"
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
    timeout server 10m

backend docker_back_tcp
    mode tcp
    option tcplog
    server d 127.0.0.1:${DOCKER_INTERNAL_PORT}
    timeout server 10m

backend docker_back
    mode http
    server d 127.0.0.1:${DOCKER_INTERNAL_PORT}
    timeout server 10m

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
            HostLogPath=${MANTA_DOCKER_PATH}/logs/\$(hostname)/
            ContainerLogPath=\${HostLogPath}/\${ContainerId}
            manta \${HostLogPath} -XPUT -H "content-type: application/json; type=directory"
            manta \${ContainerLogPath} -XPUT -H "content-type: application/json; type=directory"
            manta \${ContainerLogPath}/\$(date +"%F").log -XPUT -T \${f}
            mv \${f} ${LOGS_DIR}/\${ContainerId}-last.log
        done
    endscript
}
END

    wget -c "${DEP_URL}/logrotate_3.8.7-1ubuntu1_amd64.deb"
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
