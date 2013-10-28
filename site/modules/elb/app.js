'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
var key = fs.readFileSync(config.elb.keyPath).toString();
var pem = require('pem');
var multiparty = require('multiparty');
module.exports = function execute(scope, app) {
    var client = restify.createJsonClient({
        url: config.elb.url,
        rejectUnauthorized: false,
        signRequest: function (req) {
            httpSignature.sign(req, {
                key: key,
                keyId: config.elb.keyId
            });
        }
    });

    app.get('/list', function (req, res) {
        client.get('/loadbalancers', function getLoadBalancers(err, creq, cres, obj) {
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
        client.post('/loadbalancers', req.body, function addLoadBalancer(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.get('/item/:id', function (req, res) {
        client.get('/loadbalancers/' + req.params.id, function getLoadBalancer(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.put('/item/:id', function (req, res) {
        client.put('/loadbalancers/' + req.params.id, req.body, function updateLoadBalancer(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.delete('/item/:id', function (req, res) {
        client.del('/loadbalancers/' + req.params.id, function deleteLoadBalancer(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.get('/item/:id/usage', function (req, res) {
        client.get('/loadbalancers/' + req.params.id + '/usage?metric=bytesin', function getBytesIn(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            var result = [obj];
            client.get('/loadbalancers/' + req.params.id + '/usage?metric=bytesout', function getBytesOut(err, creq, cres, obj) {
                if (err) {
                    res.send(400, err);
                    return;
                }
                result.push(obj);
                res.json(result);
            });
        });
    });

    app.put('/item/:id/machines/:host', function (req, res) {
        client.put('/loadbalancers/' + req.params.id + '/machines/' + req.params.host, function addMachine(err, creq, cres, obj) {
            if (err) {
                res.send(400, err);
                return;
            }
            res.json(obj);
        });
    });

    app.delete('/item/:id/machines/:host', function (req, res) {
        client.del('/loadbalancers/' + req.params.id + '/machines/' + req.params.host, function deleteMachine(err, creq, cres, obj) {
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
        if (start >= 0 && end >= 0) {
            return pemSrc.substring(start, end);
        }
        return null;
    }

    app.post('/certificates', function (req, res) {
        var form = new multiparty.Form();
        form.parse(req, function handleForm(err, fieldsObject, filesObject) {
            if (err || !filesObject.certificate) {
                res.send(400, 'Certificate not found');
                return;
            }
            var data = {}, pemSrc = fs.readFileSync(filesObject.certificate.path, 'utf8');
            data['private'] = parsePemSection(pemSrc, 'RSA PRIVATE KEY');
            if (!data['private']) {
                res.send(400, 'Private key not found in PEM');
                return;
            }
            pem.getPublicKey(pemSrc, function (err, publicKey) {
                if (err) {
                    res.send(400, 'Public key not found in PEM: ' + err);
                    return;
                }
                data['public'] = publicKey;
                client.post('/certificates', data, function (err, creq, cres, obj) {
                    if (err) {
                        res.send(400, err);
                        return;
                    }
                    res.json(obj);
                });
            });
        });
    });
};