'use strict';
var util = require('util');
var url = require('url');
var WebSocket = require('ws');

module.exports = function (app) {
    var Docker = require('./').Docker;

    function send(socket, message) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(message);
        }
    }
    function close(socket, error) {
        var closeSocket = function (error) {
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
        send(socket, 'ready');
        socket.once('message', function (data) {
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
    }

    function execStart(client, data, socket) {
        if (!data.host.isSdc) {
            var dockerUrl = client.options.url;
            var parsedUrl = url.parse(dockerUrl);
            parsedUrl.port = Docker.DOCKER_TCP_PORT;
            delete parsedUrl.host;
            client.options.url = url.format(parsedUrl);
        }
        client.execStart(util._extend({id: data.execId, headers: data.headers || {}}, data.options), function (error, req) {
            if (!data.host.isSdc) {
                client.options.url = dockerUrl;
            }
            if (error) {
                return close(socket, error);
            }

            req.on('upgrade', function (res, clientSocket) {
                socket.on('message', function (message) {
                    clientSocket.write(message.toString('ascii'));
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
                if (err) {
                    return close(socket, error);
                }
                socket.on('message', function (message) {
                    req.connection.write(message.toString('ascii'));
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

    function convertToDockerStats(data) {
        data = data.stats[0];
        var cpuStats = data.cpu;
        delete data.cpu;
        var memStats = data.memory;
        delete data.memory;
        data.read = data.timestamp;
        delete data.timestamp;

        data['cpu_stats'] = {
            'cpu_usage': {
                'total_usage': cpuStats.usage.total,
                'percpu_usage': cpuStats.usage['per_cpu_usage'],
                'usage_in_usermode': cpuStats.usage.user
            },
            'system_cpu_usage': cpuStats.usage.system
        };
        data['memory_stats'] = {
            'usage': memStats.usage,
            'limit': memStats['working_set']
        };
        return JSON.stringify(data);
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

                send(socket, convertToDockerStats(stats));
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
        initConnection(socket, function (data) {
            Docker.createClient({log: req.log, req: req}, data.host, function (error, client) {
                data.execId = req.params.id;
                execStart(client, data, socket);
            });

        });
    });

    app.ws('/stats/:id', function (socket, req) {
        initConnection(socket, function (data) {
            Docker.createClient({log: req.log, req: req}, data.host, function (error, client) {
                client.getVersion(function (error, info) {
                    if (info.Version < '1.6.0') {
                        processCadvisorStats(client, data, socket);
                    } else {
                        processDockerStats(client, req, data, socket);
                    }
                });
            });
        });
    });
};
