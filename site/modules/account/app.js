'use strict';

var crypto = require('crypto');
var conf = require('easy-config');
var fs = require('fs');

module.exports = function (scope, app, callback) {
    var keyGen = null;

    app.get('/key-generator.sh', function(req, res, next) {
        // replace username in the script with correct one
        var data = keyGen.replace('{{username}}', 'admin');

        res.set('Content-type', 'application/x-sh');
        res.send(data);
    });

    fs.readFile(__dirname +'/data/key-generator.sh','utf8', function (err, data) {
        if(err) {
            scope.log.fatal(err);
            process.exit();
            return;
        }
        keyGen = data;
        callback();
    });
};