#! /bin/bash

export REPOSITORY=https://codeload.github.com/joyent/dtrace-runner/tar.gz/master
export LOCALFOLDER=/opt/dtrace
export DTRACESERVICE=node-dtrace-service
export LOGFILE=/var/log/dtrace-install.log
export MARKER=/var/tmp/.dtrace-installed


if [ -e ${MARKER} ]; then
    exit 0
fi

exec 5>&1 3>&1 4>&1 2>&1 1>${LOGFILE}
set -x
set -e

/opt/local/bin/mkdir -p ${LOCALFOLDER} && cd $_
/usr/sbin/mdata-get ca > ca.pem
/usr/sbin/mdata-get server-cert > server-cert.pem
/usr/sbin/mdata-get server-key > server-key.pem

echo "cloning repository"
/opt/local/bin/curl -sS ${REPOSITORY} | /opt/local/bin/tar --strip-components=1 -xzf -

/usr/sbin/svccfg import node-server-manifest.xml
/opt/local/bin/touch ${MARKER}
echo "complete"

exit 0
