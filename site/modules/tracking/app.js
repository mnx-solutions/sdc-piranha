'use strict';

var crypto = require('crypto');

module.exports = function execute(scope, app) {

    app.get('/sha/:email', function(req, res) {
        var privatekey = scope.config.marketo.apikey;

        var sha = crypto.createHash('sha1');

        sha.update(privatekey + req.params.email);
        var enc_email = sha.digest('hex');

        res.send(enc_email);
    });
};