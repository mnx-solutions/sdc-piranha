#! /bin/bash

if [ -e /var/tmp/.docker-installed ]; then exit 0; fi;
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9;
sudo sh -c "echo deb https://get.docker.io/ubuntu docker main > /etc/apt/sources.list.d/docker.list";
sudo apt-get update;
sudo curl -sSL https://get.docker.io/ubuntu/ | sudo sh || /bin/true;
export STATE=true ; while $STATE ; do if pgrep mkfs.ext3  >/dev/null ; then  echo "waiting for mkfs to complete"; else export STATE=false ; fi ; sleep 6 ; done ; \
sudo mkdir /mnt/docker;
sudo service docker stop;
sudo echo \'DOCKER_OPTS="-g /mnt/docker/"\' >> /etc/default/docker;
sudo service docker start;
touch /var/tmp/.docker-installed
sleep 5;
sudo docker pull google/cadvisor:latest
sudo docker run   --volume=/var/run:/var/run:rw   --volume=/sys:/sys:ro   --volume=/mnt/docker/:/var/lib/docker:ro   --publish=8088:8080   --detach=true   --name=cAdvisor google/cadvisor:latest;
