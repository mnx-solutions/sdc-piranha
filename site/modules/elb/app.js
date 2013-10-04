process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var restify = require('restify');
var client = restify.createJsonClient({
    url: 'https://localhost:4000',
    rejectUnauthorized: false
});

module.exports = function execute(scope, app) {
    app.get('/', function (req, res) {
        client.get('/loadbalancers', function(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.post('/', function (req, res, next) {
        //
    });

    app.get('/:id', function (req, res, next) {
        //
    });

    app.post('/:id', function (req, res, next) {
        //
    });

    app.delete('/:id', function (req, res, next) {
        //
    });
};