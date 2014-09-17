#!/bin/sh
mkdir ${KEYS_PATH}
cd ${KEYS_PATH}
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
    -new -x509 -days 365 -key ca-key.pem -out ca.pem
###################### End CA

###################### Server
# create server-key
openssl genrsa -des3 -passout pass:${SERVER_PASS} -out server-key.pem 2048
# remove passphrase
openssl rsa  -passin pass:${SERVER_PASS} -in server-key.pem -out server-key.pem
# create cert request
openssl req -subj '/CN=docker' -new -key server-key.pem -out server.csr
# create server certificate
openssl x509 -passin pass:${CA_PASS} -req -days 365 -in server.csr -CA ca.pem -CAkey ca-key.pem \
  -out server-cert.pem
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
openssl x509 -passin pass:${CA_PASS} -req -days 365 -in client.csr -CA ca.pem -CAkey ca-key.pem \
  -out cert.pem -extfile extfile.cnf
# create client pkcs12
# openssl pkcs12 -export -in cert.pem -inkey key.pem -certfile ca.pem -name "docker-client-pkcs12" -out docker-cert.p12
####################### End Client
