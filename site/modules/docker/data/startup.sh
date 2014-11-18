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
CADVISOR_VERSION=$(/usr/sbin/mdata-get cadvisor-version)
if [ ! -z "${DOCKER_VERSION}" ];then
    DOCKER_VERSION="-${DOCKER_VERSION}"
fi
if [ ! -z "${CADVISOR_VERSION}" ];then
    CADVISOR_VERSION=":${CADVISOR_VERSION}"
else
    CADVISOR_VERSION=":latest"
fi
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
    /usr/sbin/mdata-delete ${key}
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
    if [ ! -e /usr/lib/apt/methods/https ]; then
        apt-get update
        apt-get install -y apt-transport-https
    fi
    
    apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9;
    echo "deb https://get.docker.io/ubuntu docker main" > /etc/apt/sources.list.d/docker.list
    apt-get update;
    apt-get install -y lxc-docker${DOCKER_VERSION};
    
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

    echo "DOCKER_OPTS=\"-g /mnt/docker --api-enable-cors=true\"" >> /etc/default/docker
    service docker start
}

function createBalancer {
    local name=$1
    local port=$2    
    local docker_address=$3
    local cadviser_address=$4
    local registry_address=$5
    apt-get install -y nginx
    /etc/init.d/nginx stop
    rm /etc/nginx/sites-available/default
    usermod -a -G docker www-data

    cat <<END > /etc/nginx/sites-enabled/${name}
        server {
               listen ${port} ssl;
               server_name localhost;
        
               ssl on;
               ssl_certificate /root/.docker/server-cert.pem;
               ssl_certificate_key /root/.docker/server-key.pem;
               ssl_client_certificate /root/.docker/ca.pem;
               ssl_session_timeout 5m;
        
               ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
               ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
               ssl_prefer_server_ciphers on;
               ssl_verify_client on;
        
               proxy_connect_timeout 1;
               proxy_send_timeout 1;
               proxy_read_timeout 1;
               send_timeout 1;
               location / {
                    proxy_pass http://${docker_address};
               }
               location /utilization/ {
                    proxy_pass http://${cadviser_address}/api/v1.1/containers/;
               }
        }
END
    local ADDRESSES=""
    for addr in ${IP_ADDRESSES};do
        ADDRESSES="${ADDRESSES}\n\t\tlisten ${addr}:5000 ssl;"
    done
    ADDRESSES=$(echo -e ${ADDRESSES})
    cat <<END > /etc/nginx/sites-enabled/${name}-registry
        server {
               ${ADDRESSES}
               server_name localhost;
        
               ssl on;
               ssl_certificate /root/.docker/server-cert.pem;
               ssl_certificate_key /root/.docker/server-key.pem;
               ssl_client_certificate /root/.docker/ca.pem;
               ssl_session_timeout 5m;
        
               ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
               ssl_ciphers "HIGH:!aNULL:!MD5 or HIGH:!aNULL:!MD5:!3DES";
               ssl_prefer_server_ciphers on;
               ssl_verify_client on;
        
               location / {
                    proxy_pass http://${registry_address};
               }
        }
END
    /etc/init.d/nginx start
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
    apt-get install -y logrotate
}

writeStage "installing docker"
installDocker

writeStage "setting up API"
createBalancer docker 4243 unix:/var/run/docker.sock 127.0.0.1:14242 127.0.0.1:5000

writeStage "installing log rotator"
installLogRotator

touch /var/tmp/.docker-installed
sleep 5;

writeStage "installing CAdvisor"
docker run \
    -v /var/run/docker.sock:/var/run/docker.sock:rw \
    -v /sys:/sys:ro \
    -v ${DOCKER_DIR}/:/var/lib/docker:ro \
    -p 127.0.0.1:14242:8080 \
    -d --name=cAdvisor google/cadvisor${CADVISOR_VERSION}

writeStage "completed"
