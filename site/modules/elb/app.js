process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

    app.get('/item', function (req, res, next) {
        res.json({});
    });

    app.post('/item', function (req, res, next) {
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

    app.post('/item/:id', function (req, res, next) {
        client.post('/loadbalancers/' + req.params.id, req.body, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.delete('/item/:id', function (req, res, next) {
        client.del('/loadbalancers/' + req.params.id, function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });
};