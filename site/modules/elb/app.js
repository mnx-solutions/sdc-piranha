var restify = require('restify');
var client = restify.createJsonClient({
    url: 'https://localhost:4000',
    rejectUnauthorized: false
});
var fs = require('fs');
var pem = require('pem');

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

    app.post('/certificates', function (req, res) {
        if (!req.files || !req.files.certificate) {
            res.send(400, 'Certificate not found');
            return;
        }
        pem.readCertificateInfo(fs.readFileSync(req.files.certificate.path, 'utf8'), function (err, modules) {
            if (err) {
                res.send(400, 'Certificate is not in PEM format: ' + err);
                return;
            }
            console.log(modules);
            var data = {};
            client.post('/certificates', data, function (err, creq, cres, obj) {
                if (err) {
                    res.send(400, err);
                    return;
                }
                res.json(obj);
            });
        });

    });

    /*
     #define PEM_STRING_X509_OLD     "X509 CERTIFICATE"
     #define PEM_STRING_X509         "CERTIFICATE"
     #define PEM_STRING_X509_PAIR    "CERTIFICATE PAIR"
     #define PEM_STRING_X509_TRUSTED "TRUSTED CERTIFICATE"
     #define PEM_STRING_X509_REQ_OLD "NEW CERTIFICATE REQUEST"
     #define PEM_STRING_X509_REQ     "CERTIFICATE REQUEST"
     #define PEM_STRING_X509_CRL     "X509 CRL"
     #define PEM_STRING_EVP_PKEY     "ANY PRIVATE KEY"
     #define PEM_STRING_PUBLIC       "PUBLIC KEY"
     #define PEM_STRING_RSA          "RSA PRIVATE KEY"
     #define PEM_STRING_RSA_PUBLIC   "RSA PUBLIC KEY"
     #define PEM_STRING_DSA          "DSA PRIVATE KEY"
     #define PEM_STRING_DSA_PUBLIC   "DSA PUBLIC KEY"
     #define PEM_STRING_PKCS7        "PKCS7"
     #define PEM_STRING_PKCS7_SIGNED "PKCS #7 SIGNED DATA"
     #define PEM_STRING_PKCS8        "ENCRYPTED PRIVATE KEY"
     #define PEM_STRING_PKCS8INF     "PRIVATE KEY"
     #define PEM_STRING_DHPARAMS     "DH PARAMETERS"
     #define PEM_STRING_SSL_SESSION  "SSL SESSION PARAMETERS"
     #define PEM_STRING_DSAPARAMS    "DSA PARAMETERS"
     #define PEM_STRING_ECDSA_PUBLIC "ECDSA PUBLIC KEY"
     #define PEM_STRING_ECPARAMETERS "EC PARAMETERS"
     #define PEM_STRING_ECPRIVATEKEY "EC PRIVATE KEY"
     #define PEM_STRING_CMS          "CMS"
     */
};