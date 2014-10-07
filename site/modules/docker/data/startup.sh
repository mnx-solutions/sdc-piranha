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
DOCKER_VERSION="-1.1.2"
DOCKER_DIR=/mnt/docker
LOGS_DIR=/mnt/manta

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

manta /${MANTA_USER}/stor/dockerLogs -X PUT -H "content-type: application/json; type=directory"
manta /${MANTA_USER}/stor/dockerLogs/$(hostname) -X PUT -H "content-type: application/json; type=directory"

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
        
               location / {
                    proxy_pass http://${docker_address};
               }
               location /utilization/ {
                    proxy_pass http://${cadviser_address}/api/v1.1/containers/;
               }
        }
END

    cat <<END > /etc/nginx/sites-enabled/${name}-registry
        server {
               listen 127.0.0.1:5000;
               server_name localhost;
        
               location / {
                    proxy_pass http://${registry_address};
               }
        }
        server {
               listen 5000 ssl;
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
            keyId=/${MANTA_USER}/keys/${MANTA_KEY_ID}
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
            ContainerLogPath=/${MANTA_USER}/stor/dockerLogs/\$(hostname)/\${ContainerId}
            manta \${ContainerLogPath} -XPUT -H "content-type: application/json; type=directory"
            manta \${ContainerLogPath}/\$(date +"%F").log -XPUT -T \${f}
            mv \${f} ${LOGS_DIR}/\${ContainerId}-last.log
        done
    endscript 
}
END
    apt-get install -y logrotate
}

function installRegistry {
    cat <<END > /tmp/Dockerfile
FROM registry:latest

MAINTAINER Vladimir Bulyga <zero@13w.me>

RUN echo "\\\\n\\
common: &common\\\\n\\
    loglevel: _env:LOGLEVEL:info\\\\n\\
    debug_versions: _env:DEBUG_VERSIONS:false\\\\n\\
    standalone: _env:STANDALONE:true\\\\n\\
    storage_redirect: _env:STORAGE_REDIRECT\\\\n\\
    disable_token_auth: _env:DISABLE_TOKEN_AUTH\\\\n\\
    privileged_key: _env:PRIVILEGED_KEY\\\\n\\
    search_backend: _env:SEARCH_BACKEND\\\\n\\
    sqlalchemy_index_database: _env:SQLALCHEMY_INDEX_DATABASE:sqlite:////tmp/docker-registry.db\\\\n\\
    mirroring:\\\\n\\
        source: _env:MIRROR_SOURCE\\\\n\\
        source_index: _env:MIRROR_SOURCE_INDEX\\\\n\\
        tags_cache_ttl: _env:MIRROR_TAGS_CACHE_TTL:172800\\\\n\\
\\\\n\\
    cache:\\\\n\\
        host: _env:CACHE_REDIS_HOST\\\\n\\
        port: _env:CACHE_REDIS_PORT\\\\n\\
        db: _env:CACHE_REDIS_DB:0\\\\n\\
        password: _env:CACHE_REDIS_PASSWORD\\\\n\\
\\\\n\\
    cache_lru:\\\\n\\
        host: _env:CACHE_LRU_REDIS_HOST\\\\n\\
        port: _env:CACHE_LRU_REDIS_PORT\\\\n\\
        db: _env:CACHE_LRU_REDIS_DB:0\\\\n\\
        password: _env:CACHE_LRU_REDIS_PASSWORD\\\\n\\
\\\\n\\
    email_exceptions:\\\\n\\
        smtp_host: _env:SMTP_HOST\\\\n\\
        smtp_port: _env:SMTP_PORT:25\\\\n\\
        smtp_login: _env:SMTP_LOGIN\\\\n\\
        smtp_password: _env:SMTP_PASSWORD\\\\n\\
        smtp_secure: _env:SMTP_SECURE:false\\\\n\\
        from_addr: _env:SMTP_FROM_ADDR:docker-registry@localdomain.local\\\\n\\
        to_addr: _env:SMTP_TO_ADDR:noise+dockerregistry@localdomain.local\\\\n\\
\\\\n\\
    bugsnag: _env:BUGSNAG\\\\n\\
\\\\n\\
joyent_manta: &joyent_manta\\\\n\\
    <<: *common\\\\n\\
    storage: joyent_manta\\\\n\\
    path: _env:REGISTRY_PATH:'/%s/stor/registry'\\\\n\\
    url: _env:MANTA_URL:'https://us-east.manta.joyent.com/'\\\\n\\
    insecure: _env:MANTA_TLS_INSECURE:False\\\\n\\
    key_id: _env:MANTA_KEY_ID\\\\n\\
    private_key: _env:MANTA_PRIVATE_KEY\\\\n\\
    account: _env:MANTA_USER\\\\n\\
\\\\n\\
# This is the default configuration when no flavor is specified\\\\n\\
dev: &dev\\\\n\\
    <<: *joyent_manta\\\\n\\
    loglevel: _env:LOGLEVEL:debug\\\\n\\
    debug_versions: _env:DEBUG_VERSIONS:true\\\\n\\
    storage: joyent_manta\\\\n\\
    search_backend: _env:SEARCH_BACKEND:sqlalchemy" >/config.yml

RUN pip install docker-registry-driver-joyent_manta

ENV MANTA_KEY_ID ${MANTA_KEY_ID}
ENV MANTA_PRIVATE_KEY /root/.ssh/user_id_rsa
ENV MANTA_USER ${MANTA_USER}
ENV SETTINGS_FLAVOR dev
ENV SEARCH_BACKEND sqlalchemy
ENV DOCKER_REGISTRY_CONFIG /config.yml
ENV REGISTRY_PORT 5000

END
    docker build --force-rm --tag="local-registry" /tmp
    docker run -d -p 15000:5000 -v /root/.ssh:/root/.ssh --name=local-registry local-registry
}

writeStage "initialization"
if [ -z ${DISABLE_TLS} ]; then
    writeStage "downloading certificates"
    downloadCertificates
fi

writeStage "installing docker"
installDocker

writeStage "creating load balancer"
createBalancer docker 4243 unix:/var/run/docker.sock 127.0.0.1:14242 127.0.0.1:15000

writeStage "installing log rotator"
installLogRotator

touch /var/tmp/.docker-installed
sleep 5;

writeStage "installing registry"
installRegistry

writeStage "installing CAdvisor"
docker run \
    -v /var/run/docker.sock:/var/run/docker.sock:rw \
    -v /sys:/sys:ro \
    -v ${DOCKER_DIR}/:/var/lib/docker:ro \
    -p 127.0.0.1:14242:8080 \
    -d --name=cAdvisor google/cadvisor:latest -storage_driver=influxdb -log_dir=/

writeStage "completed"
