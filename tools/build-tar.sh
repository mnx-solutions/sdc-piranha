#!/usr/bin/env bash

LAST_TAG_HREF=$(git rev-list --tags --max-count=1)
TAG_NAME=$(git describe --tags ${LAST_TAG_HREF})
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PRIVATE=

function checkAndInstall {
    PKG_NAME=$1
    echo -n " * Checking ${PKG_NAME}... "
    if [ "$(pkgin list | grep -c ${PKG_NAME})" == "0" ];then
        echo -n "installing ${PKG_NAME}... "
        pkgin -y in ${PKG_NAME} 2>&1 >/dev/null
    fi
    echo "ok"
}

while [[ $# > 0 ]]; do
    key="$1"

    case ${key} in
        -p|--private)
            PRIVATE=1
            shift # past argument
        ;;
        -h|--help)
            cat <<END
Usage: $0 [args]
    args:
        -p | --private - build private
END
            exit 0
        ;;
    esac
done

PACKAGE_NAME="piranha-portal"

echo -n "Creating package for "

if [ "${TAG_NAME}" != "${CURRENT_BRANCH}" -a "${CURRENT_BRANCH}" != "HEAD" ]; then
    PACKAGE_NAME="${PACKAGE_NAME}-${CURRENT_BRANCH}"
    echo "branch \"${CURRENT_BRANCH}\""
else
    PACKAGE_NAME="${PACKAGE_NAME}-${TAG_NAME}"
    echo "tag \"${TAG_NAME}\""
fi

PACKAGE_NAME="${PACKAGE_NAME}.tar"

ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>&1 >/dev/null
ssh-keyscan -H git.joyent.com >> ~/.ssh/known_hosts 2>&1 >/dev/null

echo "Checking dependencies... "
checkAndInstall gcc49
checkAndInstall gcc49-libs
checkAndInstall gmake

echo -n "Installing npm modules... "
rm -rf node_modules
NPM_OK=$(npm install --production 2>&1 >/dev/null | grep "not ok")

if [ ! -z "${NPM_OK}" ];then
    echo "fail"
    exit 1
fi
echo "done"

echo -n "Creating package ${PACKAGE_NAME}... "
tar -cf ${PACKAGE_NAME} -X ./tools/.tarignore *
tar -uf ${PACKAGE_NAME} ./site/config/config.blacklist.json

if [ ! -z ${PRIVATE} ];then
    sed -i -e 's/gulp serve/gulp serve -env=pro/g' ./smf/portal.xml
    sed -i '/NODE_ENV/ d' ./smf/portal.xml
    tar -uf ${PACKAGE_NAME} ./smf/portal.xml
    git checkout ./smf/portal.xml
fi

gzip -f ${PACKAGE_NAME}

echo "done"
