var restify = require('restify');
var client = restify.createJsonClient({
    url: 'https://localhost:4000',
    rejectUnauthorized: false
});

module.exports = function execute(scope, app) {
    app.get('/list', function (req, res) {
        client.get('/loadbalancers', function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.get('/item', function (req, res) {
        res.json({});
    });

    app.post('/item', function (req, res) {
        client.post('/loadbalancers', req.body, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.get('/item/:id', function (req, res) {
        client.get('/loadbalancers/' + req.params.id, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.put('/item/:id', function (req, res) {
        client.put('/loadbalancers/' + req.params.id, req.body, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.delete('/item/:id', function (req, res) {
        client.del('/loadbalancers/' + req.params.id, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.post('/item/:id/machines/:host', function (req, res) {
        client.put('/loadbalancers/' + req.params.id + '/machines/' + req.params.host, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.delete('/item/:id/machines/:host', function (req, res) {
        client.del('/loadbalancers/' + req.params.id + '/machines/' + req.params.host, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });
};