#!/usr/bin/env bash

SERVER=us-west-1.api.joyentcloud.com
KEYNAME=JoyentCloud

echo "------------------------------------------------------"
echo "JOYENT SSH KEY GENERATION"
echo

TRIES=0
STATUS_CODE=201
USER="admin"

while [  $TRIES -lt 3 ]; do

    if [ $TRIES -eq 0 ]; then
        echo "Please supply your Joyent Cloud login info to continue:"
    else
        echo "Please reenter your Joyent Cloud login credentials:"
    fi

    read -p -p "username: " USER
    read -s -p "password: " PASSWORD
    echo

    RESPONSE_CODE=`curl --write-out '%{http_code}' -o /dev/null -u $USER:$PASSWORD -s -H "Accept: application/json" -H "X-Api-Version: 6.5.0" -X GET https://$SERVER/my/keys`
    STATUS_CODE=$RESPONSE_CODE
    VALID_USER=0

    case $RESPONSE_CODE in
        200)
            break ;;
        401)
            echo "---------------------------"
            echo "ERROR: Invalid Credentials" ;
            continue ;;
        *)
            continue;
            break ;;
    esac

    if [ -f ~/.ssh/id_rsa.pub ]; then
        echo "1) Found an existing SSH Public Key (in local file: ~/.ssh/id_rsa.pub)"
        PUB_KEY_PATH=~/.ssh/id_rsa.pub

    elif [  -f ~/.ssh/id_dsa.pub ]; then
        echo "1) Found an existing SSH Public Key (in local file: ~/.ssh/id_dsa.pub)"
        PUB_KEY_PATH=~/.ssh/id_dsa.pub

    else
        if ssh-keygen -t rsa -f ~/.ssh/id_rsa -N ""; then
            echo "1) Generated SSH Key pair successfully (stored locally at: ~/.ssh/id_rsa.pub)"
            PUB_KEY_PATH=~/.ssh/id_rsa.pub
        else
            echo "1) ERROR: Generate SSH Key error. Failed to create public/private key pair."
              exit 1
        fi
    fi

    echo "2) Uploading SSH Public Key to your Joyent Cloud account"
    PUB_KEY=`cat $PUB_KEY_PATH`
    RESPONSE_CODE=`curl --write-out '%{http_code}' -o /dev/null -u $USER:$PASSWORD -s -H "Accept: application/json" -H "X-Api-Version: 6.5.0" -X POST --data-urlencode "name=$KEYNAME" --data-urlencode "key=$PUB_KEY" https://$SERVER/my/keys`
    STATUS_CODE=$RESPONSE_CODE
    case $RESPONSE_CODE in
        201)
            break ;;
        401)
          echo "---------------------------"
          echo "ERROR: Invalid Credentials" ;;
        409)
          break ;;
        *)
          break ;;
    esac

    let TRIES=TRIES+1
    echo


done
case $STATUS_CODE in
  201|409)
    echo "3) SSH Key added successfully."
    echo
    echo "PLEASE RETURN TO YOUR BROWSER TO CONTINUE." ;;
  401)
    echo "FAILED TO LOGIN AFTER 3 ATTEMPTS."
    echo "For more help please see the forums or contact support at support@joyent.com" ;;
  *)
    echo "FAILED: There was a server connection error. Please try again later." ;;
esac
