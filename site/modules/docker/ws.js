'use strict';
var util = require('util');
var url = require('url');
var WebSocket = require('ws');

module.exports = function (app) {
    var Docker = require('./').Docker;

    function fixNonUnicodeCharacters(input) {
        return input.replace(/[\u007f-\uffff]/g, ' ');
    }

    function send(socket, message) {
        socket.log.info({message: message, state: socket.readyState}, 'Socket: send message');
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(fixNonUnicodeCharacters(message.toString('UTF-8')));
        }
    }
    function close(socket, error) {
        var closeSocket = function (error) {
            socket.log.info({cause: error}, 'Close socket');
            if (error) {
                send(socket, error.message || error);
            }
            if (socket.readyState !== WebSocket.CLOSED) {
                socket.close();
            }
        };
        if (error) {
            return closeSocket(error);
        }
        return closeSocket;
    }

    function initConnection(socket, callback) {
        socket.once('message', function (data) {
            socket.log.info({message: data}, 'initConnection: send receive message');
            try {
                data = JSON.parse(data);
            } catch (e) {
                if (socket.readyState === WebSocket.OPEN) {
                    send(socket, 'Failed to parse data');
                }
                return socket.close();
            }
            callback(data);
        });
        socket.log.info('initConnection: send ready');
        send(socket, 'ready');
    }

    function execStart(client, data, socket) {
        if (!data.host.isSdc) {
            var dockerUrl = client.options.url;
            var parsedUrl = url.parse(dockerUrl);
            parsedUrl.port = Docker.DOCKER_TCP_PORT;
            delete parsedUrl.host;
            client.options.url = url.format(parsedUrl);
        }
        client.log.info({host: data.host}, 'Exec call: exec start');
        client.execStart(util._extend({id: data.execId, headers: data.headers || {}}, data.options), function (error, req) {
            if (!data.host.isSdc) {
                client.options.url = dockerUrl;
            }
            if (error) {
                client.log.info({error: error}, 'Exec call: error!');
                return close(socket, error);
            }

            client.log.info({host: data.host}, 'Exec call: wait upgrade');
            req.on('upgrade', function (res, clientSocket) {
                client.log.info({host: data.host}, 'Exec call: upgrade complete!');
                socket.on('message', function (message) {
                    clientSocket.write(message.toString('UTF-8'));
                });
                socket.on('error', close(socket));
                clientSocket.on('data', function (data) {
                    send(socket, data.toString());
                });
                clientSocket.on('error', close(socket));
                clientSocket.on('end', close(socket));
            });
            // hijak
            req.on('result', function (err, execRes) {
                client.log.info({host: data.host, error: err}, 'Exec call: hijak!');
                if (err) {
                    return close(socket, error);
                }
                socket.on('message', function (message) {
                    req.connection.write(message.toString('UTF-8'));
                });
                socket.on('error', close(socket));
                execRes.on('data', function (data) {
                    send(socket, data.toString());
                });
                execRes.on('error', close(socket));
                execRes.on('end', close(socket));
            });
            req.write(JSON.stringify(data.options));
        });

    }

    function processDockerStats(client, req, data, socket) {
        client.stats({id: data.containerId}, function (err, req) {
            req.on('result', function (err, res) {
                if (err) {
                    return close(socket, err);
                }
                res.on('data', function (chunk) {
                    send(socket, chunk.toString());
                });
                res.on('error', close(socket));
                res.on('end', close(socket));
            });
        });

        socket.on('error', req.connection.destroy.bind(req.connection));
        socket.on('close', req.connection.destroy.bind(req.connection));
    }

    function processCadvisorStats(client, data, socket) {
        var errorCount = 3;
        var interval = setInterval(function () {
            client.containerUtilization({id: data.containerId, 'num_stats': 1}, function (error, stats) {
                if (error) {
                    if (errorCount <= 0) {
                        end();
                    }
                    errorCount -= 1;
                    return;
                }

                send(socket, JSON.stringify(Docker.convertToDockerStats(stats)));
            });
        }, 1000);
        function end() {
            clearInterval(interval);
            close(socket);
        }
        socket.on('close', end);
        socket.on('error', end);
    }

    app.ws('/exec/:id', function (socket, req) {
        req.log.info('Exec call, init connection');
        socket.log = socket.log || req.log;
        initConnection(socket, function (data) {
            req.log.info('Exec call, init complete');
            var client = Docker.createClient({log: req.log, req: req}, data.host);
            client.log = client.log || req.log;
            data.execId = req.params.id;
            execStart(client, data, socket);
        });
    });

    app.ws('/stats/:id', function (socket, req) {
        socket.log = socket.log || req.log;
        initConnection(socket, function (data) {
            var client = Docker.createClient({log: req.log, req: req}, data.host);
            client.getVersion(function (error, info) {
                if (info.Version < '1.6.0') {
                    processCadvisorStats(client, data, socket);
                } else {
                    processDockerStats(client, req, data, socket);
                }
            });
        });
    });
};
