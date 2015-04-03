#! /bin/bash

REPOSITORY=https://github.com/joyent/dtrace-runner.git
LOCALFOLDER=/opt/dtrace
DTRACESERVICE=node-dtrace-service
LOGFILE=/var/log/dtrace-install.log
MARKER=/var/tmp/.dtrace-installed

exec > $LOGFILE

if [ -e $MARKER ]; then
    exit 0
fi

echo "check and install git gmake gcc47"
/opt/local/bin/pkgin -y install git gmake gcc47

echo "cloning repository"
mkdir $LOCALFOLDER && /opt/local/bin/git clone $REPOSITORY $LOCALFOLDER;

if [ -f $LOCALFOLDER/node-server-manifest.xml ]; then
    /usr/sbin/svccfg import $LOCALFOLDER/node-server-manifest.xml
    /usr/sbin/svcadm clear $DTRACESERVICE
    touch MARKER
    echo "complete"
else
    echo "error occurred upon cloning the repository"
fi
exit 0