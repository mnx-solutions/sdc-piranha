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
/usr/sbin/mdata-get private-key > /root/.ssh/user_id_rsa
/usr/sbin/mdata-get public-key > /root/.ssh/user_id_rsa.pub

export MANTA_URL=$(/usr/sbin/mdata-get manta-url | sed -e 's/[]\/$*.^|[]/\\&/g')
export MANTA_USER=$(/usr/sbin/mdata-get manta-account)
export MANTA_SUBUSER=$(/usr/sbin/mdata-get manta-subuser)

echo "cloning repository"
/opt/local/bin/curl -sS ${REPOSITORY} | /opt/local/bin/tar --strip-components=1 -xzf -

echo "setup node-server-manifest"
cat ${LOCALFOLDER}/node-server-manifest.xml.templ | \
    sed "s/%MANTA_USER%/$MANTA_USER/g" | \
	sed "s/%MANTA_URL%/$MANTA_URL/g" | \
	sed "s/%MANTA_SUBUSER%/$MANTA_SUBUSER/g" > ${LOCALFOLDER}/node-server-manifest.xml

/usr/sbin/svccfg import node-server-manifest.xml
/opt/local/bin/touch ${MARKER}
echo "complete"

for key in $(echo "user-script private-key public-key manta-account manta-url manta-subuser ca server-key server-cert");do
    /usr/sbin/mdata-delete ${key} &
done

exit 0
