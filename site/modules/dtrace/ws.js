'use strict';
var WebSocket = require('ws');

var DTRACE_PORT = 8000;

module.exports = function (app, log, config) {
    app.ws('/exec/:id/:host', function (socket, req) {
        var certificates = req.session.devtoolsCerts;
        var id = req.params['id'];
        var host = req.params['host'];
        var execType;

        var wsc = new WebSocket('wss://' + host + ':' + DTRACE_PORT + '/' + id, {
            rejectUnauthorized: false,
            requestCert: true,
            ca: certificates.ca,
            cert: certificates.cert,
            key: certificates.key
        });

        function closeSocket () {
            wsc.close();
            socket.close();
        }

        socket.on('message', function (message) {
            var parsedDtraceObj;
            try {
                parsedDtraceObj = JSON.parse(message);
            } catch (ex) {
                req.log.error('Error while JSON parsing dtrace object', ex);
                return closeSocket();
            }
            execType = parsedDtraceObj.type;

            req.log.info('User executed %s', execType);
            if (execType === 'heatmap') {
                req.log.info({
                    scriptName: parsedDtraceObj.name,
                    scriptBody: parsedDtraceObj.message
                }, 'Script executed');
            }

            if (wsc.readyState === WebSocket.OPEN) {
                wsc.send(message);
            }
        });

        wsc.onmessage = function (event) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        wsc.onopen = function () {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send('connection');
            }
        };
        wsc.onerror = function (error) {
            if (socket.readyState === WebSocket.OPEN) {
                var message = error.data || error;
                socket.send(JSON.stringify({error: message.toString()}));
            }
            closeSocket();
        };

        wsc.onclose = socket.close;

        socket.on('error', function () {
            closeSocket();
        });
        socket.on('close', function () {
            wsc.close();
        });
    });
};
