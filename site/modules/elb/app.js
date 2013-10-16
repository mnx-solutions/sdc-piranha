var assert = require('assert');
var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
var key = fs.readFileSync(config.elb.keyPath).toString(); 
var pem = require('pem');
module.exports = function execute(scope, app) {
    var client = restify.createJsonClient({
        url: config.elb.url,
        rejectUnauthorized: false,
        signRequest: function(req) {
            httpSignature.sign(req, {
                key: key,
                keyId: config.elb.keyId
            })
        }
    });

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

    app.put('/item/:id/machines/:host', function (req, res) {
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

    function parsePemSection(pemSrc, sectionName) {
        var start = -1, end = -1, startMatch, endMatch;
        if ((startMatch = pemSrc.match(new RegExp('\\-+BEGIN ' + sectionName + '\\-+$', 'm')))) {
            start = startMatch.index;
        }
        if ((endMatch = pemSrc.match(new RegExp('^\\-+END ' + sectionName + '\\-+', 'm')))) {
            end = endMatch.index + (endMatch[0] || '').length;
        }
        if (start >= 0 && end >=0) {
            return pemSrc.substring(start, end);
        }
        return null;
    }

    app.post('/certificates', function (req, res) {
        if (!req.files || !req.files.certificate) {
            res.send(400, 'Certificate not found');
            return;
        }
        var data = {};
        var pemSrc = fs.readFileSync(req.files.certificate.path, 'utf8');
        data.private = parsePemSection(pemSrc, 'RSA PRIVATE KEY');
        if (!data.private) {
            res.send(400, 'Private key not found in PEM');
            return;
        }
        pem.getPublicKey(pemSrc, function (err, publicKey) {
            if (err) {
                res.send(400, 'Public key not found in PEM: ' + err);
                return;
            }
            data.public = publicKey;
            client.post('/certificates', data, function (err, creq, cres, obj) {
                if (err) {
                    res.send(400, err);
                    return;
                }
                res.json(obj);
            });
        });
    });
    console.log(config.elb);
};