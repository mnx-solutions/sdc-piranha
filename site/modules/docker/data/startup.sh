#! /bin/bash

if [ -e /var/tmp/.docker-installed ]; then 
    exit 0 
fi

/usr/sbin/mdata-get private-key > /root/.ssh/user_id_rsa
/usr/sbin/mdata-get public-key > /root/.ssh/user_id_rsa.pub
DISABLE_TLS=$(/usr/sbin/mdata-get disable-tls)
MANTA_URL=$(/usr/sbin/mdata-get manta-url)
MANTA_KEY_ID=$(ssh-keygen -lf /root/.ssh/user_id_rsa.pub | awk '{print $2}')
MANTA_USER=$(/usr/sbin/mdata-get manta-account)
KEYS_PATH=/root/.docker
MANTA_DOCKER_PATH=/${MANTA_USER}/stor/.joyent/docker

for key in $(echo "user-script private-key public-key manta-account manta-url disable-tls");do
    /usr/sbin/mdata-delete ${key}
done


function manta {
    local alg=rsa-sha256
    local keyId=/${MANTA_USER}/keys/${MANTA_KEY_ID}
    local now=$(LC_ALL=C date -u "+%a, %d %h %Y %H:%M:%S GMT")
    local sig=$(echo "date:" ${now} | \
                tr -d '\n' | \
                openssl dgst -sha256 -sign /root/.ssh/user_id_rsa | \
                openssl enc -e -a | tr -d '\n')

    curl -sS ${MANTA_URL}"$@" -H "date: $now"  \
        -H "Authorization: Signature keyId=\"$keyId\",algorithm=\"$alg\",signature=\"$sig\""
}

function writeStage {
    manta ${MANTA_DOCKER_PATH}/.status-$(hostname) -XPUT -d"{\"status\": \"$1\"}"
}

function downloadCertificates {
    if [ ! -e ${KEYS_PATH} ];then
        mkdir -p ${KEYS_PATH}
    fi

    for f in $(echo "ca.pem server-cert.pem server-key.pem key.pem cert.pem");do
        manta ${MANTA_DOCKER_PATH}/${f} > ${KEYS_PATH}/${f}
    done
}

function installDocker {
    if [ ! -e /usr/lib/apt/methods/https ]; then
        apt-get update
        apt-get install -y apt-transport-https
    fi
    
    apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9;
    echo "deb https://get.docker.io/ubuntu docker main" > /etc/apt/sources.list.d/docker.list
    apt-get update;
    apt-get install -y lxc-docker;
    
    local STATE=true
    while ${STATE} ; do
        if pgrep mkfs.ext3  >/dev/null; then
            echo "waiting for mkfs to complete"
        else
            STATE=false
        fi
        sleep 6
    done

    mkdir /mnt/docker
    service docker stop

    DOCKER_OPTS="-g /mnt/docker -H tcp://0.0.0.0:4243 -H unix:///var/run/docker.sock --api-enable-cors=true"
    if [ -z ${DISABLE_TLS} ]; then
        DOCKER_OPTS="${DOCKER_OPTS} --tlsverify --tlscacert=${KEYS_PATH}/ca.pem --tlscert=${KEYS_PATH}/server-cert.pem --tlskey=${KEYS_PATH}/server-key.pem"
    fi
    echo "DOCKER_OPTS=\"${DOCKER_OPTS}\"" >> /etc/default/docker
    service docker start
}

writeStage "initialization"
if [ -z ${DISABLE_TLS} ]; then
    writeStage "downloading certificates"
    downloadCertificates
fi

writeStage "installing docker"
installDocker

writeStage "configuring"
touch /var/tmp/.docker-installed
sleep 5;

docker run \
    -v /var/run:/var/run:rw \
    -v /sys:/sys:ro \
    -v /mnt/docker/:/var/lib/docker:ro \
    -p 8088:8080 \
    -d --name=cAdvisor google/cadvisor:latest

writeStage "completed"
