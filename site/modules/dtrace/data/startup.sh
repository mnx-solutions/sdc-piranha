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
cat <<'END' >ca.pem
%__ca__%
END

cat <<'END' >server-cert.pem
%__server-cert__%
END

cat <<'END' >server-key.pem
%__server-key__%
END

cat <<'END' >/root/.ssh/user_id_rsa
%__private-key__%
END

cat <<'END' >/root/.ssh/user_id_rsa.pub
%__public-key__%
END

export MANTA_URL=$(echo %__manta-url__% | sed -e 's/[]\/$*.^|[]/\\&/g')
export MANTA_USER=%__manta-account__%
export MANTA_SUBUSER=%__manta-subuser__%

echo "cloning repository"
/opt/local/bin/curl -sS ${REPOSITORY} | /opt/local/bin/tar --strip-components=1 -xzf -
export HOME=${HOME:-/tmp}
if [[ ! -e /opt/local/bin/make ]]; then
    /opt/local/bin/pkgin -y in gmake
fi
/opt/local/bin/npm install

echo "setup node-server-manifest"
cat ${LOCALFOLDER}/node-server-manifest.xml.templ | \
    sed "s/%MANTA_USER%/$MANTA_USER/g" | \
	sed "s/%MANTA_URL%/$MANTA_URL/g" | \
	sed "s/%MANTA_SUBUSER%/$MANTA_SUBUSER/g" > ${LOCALFOLDER}/node-server-manifest.xml

/usr/sbin/svccfg import node-server-manifest.xml
/opt/local/bin/touch ${MARKER}
echo "complete"

/usr/sbin/mdata-delete user-script &

exit 0
