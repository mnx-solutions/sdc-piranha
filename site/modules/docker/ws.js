'use strict';
var util = require('util');
var url = require('url');
var WebSocket = require('ws');

module.exports = function (app) {
    var Docker = require('./').Docker;

    function execStart(client, data, socket) {
        if (!data.host.isSdc) {
            var dockerUrl = client.options.url;
            var parsedUrl = url.parse(dockerUrl);
            parsedUrl.port = Docker.DOCKER_TCP_PORT;
            delete parsedUrl.host;
            client.options.url = url.format(parsedUrl);
        }
        function close(error) {
            if (error) {
                socket.send(error.message || error);
            }
            socket.close();
        }
        client.execStart(util._extend({id: data.execId, headers: data.headers || {}}, data.options), function (error, req) {
            if (!data.host.isSdc) {
                client.options.url = dockerUrl;
            }
            if (error) {
                return close(error);
            }

            req.on('upgrade', function (res, clientSocket) {
                socket.on('message', function (message) {
                    clientSocket.write(message.toString('ascii'));
                });
                socket.on('error', close);
                clientSocket.on('data', function (data) {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(data.toString());
                    }
                });
                clientSocket.on('error', close);
                clientSocket.on('end', close);
            });
            // hijak
            req.on('result', function (err, execRes) {
                if (err) {
                    return close(error);
                }
                socket.on('message', function (message) {
                    req.connection.write(message.toString('ascii'));
                });
                socket.on('error', close);
                execRes.on('data', function (data) {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(data.toString());
                    }
                });
                execRes.on('error', close);
                execRes.on('end', close);
            });
            req.write(JSON.stringify(data.options));
        });

    }

    app.ws('/exec/:id', function (socket, req) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send('ready');
        }
        socket.once('message', function (data) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send('Failed to parse data');
                }
                return socket.close();
            }
            Docker.createClient({log: req.log, req: req}, data.host, function (error, client) {
                data.execId = req.params.id;
                execStart(client, data, socket);
            });
        });
    });
};
