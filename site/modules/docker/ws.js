module.exports = function (app, log, config) {
    //log.warn('Registering dockr webSocket');
    app.ws('/exec/:id', function (socket, req) {
        console.log(req.log.info({params: req.params}));
        socket.close();
    });
    app.ws('/testWs', function (socket, req) {
        socket.send('OK!');
        socket.on('message', function (message) {
            req.log.info({message: message}, 'WebSocket receive message');
            socket.send('Message was: ' + message);
        });
    });
};
