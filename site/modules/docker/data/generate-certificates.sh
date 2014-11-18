#!/bin/sh
mkdir ${KEYS_PATH}
cd ${KEYS_PATH}
exec 3>&1 4>&2 1>generate-certificates.log 2>&1
set -x

CA_PASS=$(openssl rand -base64 32)
SERVER_PASS=$(openssl rand -base64 32)
CLIENT_PASS=$(openssl rand -base64 32)

##################### CA
# create serial
echo 01 > ca.srl
# create ca-key
openssl genrsa -des3 -passout pass:${CA_PASS} -out ca-key.pem 2048
# create ca.pem
openssl req -passin pass:${CA_PASS} \
    -subj "/C=US/ST=California/L=San Francisco/O=Joyent, Inc./OU=Joyent, Inc/CN=*.joyent.com" \
    -new -x509 -days 3650 -key ca-key.pem -out ca.pem
# check
openssl rsa  -passin pass:${CA_PASS} -noout -modulus -in ca-key.pem | openssl md5
openssl x509 -noout -modulus -in ca.pem | openssl md5
###################### End CA

###################### Server
# create server-key
openssl genrsa -des3 -passout pass:${SERVER_PASS} -out server-key.pem 2048
# remove passphrase
openssl rsa  -passin pass:${SERVER_PASS} -in server-key.pem -out server-key.pem
# create cert request
openssl req -subj '/CN=docker' -new -key server-key.pem -out server.csr
# create server certificate
openssl x509 -passin pass:${CA_PASS} -req -days 3650 -in server.csr -CA ca.pem -CAkey ca-key.pem \
  -out server-cert.pem
# check
openssl rsa -noout -modulus -in server-key.pem | openssl md5
openssl x509 -noout -modulus -in server-cert.pem | openssl md5
###################### End Server

###################### Client
# create client key
openssl genrsa -des3 -passout pass:${CLIENT_PASS} -out key.pem 2048
# remove passphrase
openssl rsa -passin pass:${CLIENT_PASS} -in key.pem -out key.pem
# create client cert request
openssl req -subj '/CN=client' -new -key key.pem -out client.csr

# create extension
echo "extendedKeyUsage = clientAuth" > extfile.cnf
# create client certificate
openssl x509 -passin pass:${CA_PASS} -req -days 3650 -in client.csr -CA ca.pem -CAkey ca-key.pem \
  -out cert.pem -extfile extfile.cnf
# check
openssl rsa -noout -modulus -in key.pem | openssl md5
openssl x509 -noout -modulus -in cert.pem | openssl md5
# create client pkcs12
# openssl pkcs12 -export -in cert.pem -inkey key.pem -certfile ca.pem -name "docker-client-pkcs12" -out docker-cert.p12
####################### End Client
