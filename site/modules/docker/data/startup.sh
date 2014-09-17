#!/bin/bash
if [ -e /var/tmp/.docker-installed ]; then
    exit 0
fi

if [ ! -e /usr/lib/apt/methods/https ]; then
    apt-get update
    apt-get install -y apt-transport-https
fi

apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9
echo "deb https://get.docker.io/ubuntu docker main" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y lxc-docker

export STATE=true
while $STATE ; do
    if pgrep mkfs.ext3  >/dev/null; then
        echo "waiting for mkfs to complete"
    else
        export STATE=false
    fi
    sleep 6
done
mkdir /data/docker
service docker stop
echo 'DOCKER_OPTS="-g /data/docker/ -H tcp://0.0.0.0:4243 -H unix:///var/run/docker.sock"' >> /etc/default/docker
service docker start
touch /var/tmp/.docker-installed
sleep 5
docker run \
    -v /var/run:/var/run:rw \
    -v /sys:/sys:ro \
    -v /data/docker/:/var/lib/docker:ro \
    -p 8088:8080 \
    -d --name=cAdvisor google/cadvisor:latest
