'use strict';

var crypto = require('crypto');

module.exports = function execute(app, log, config) {

    //returns sha1 hash for given email address and private key
    app.get('/sha/:email', function(req, res) {
        var privatekey = config.marketo.apikey;

        var sha = crypto.createHash('sha1');

        sha.update(privatekey + req.params.email);
        var encEmail = sha.digest('hex');

        res.send(encEmail);
    });
};
