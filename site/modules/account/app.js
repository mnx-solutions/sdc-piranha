'use strict';

var crypto = require('crypto');
var conf = require('easy-config');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var fs = require('fs');
var countryCodes = require('./data/countryCodes');

module.exports = function (scope, app, callback) {
    var keyGen = null;

    var SignupProgress = scope.api('SignupProgress');

    app.get('/tropo/:tropoid', function(req, res) {
        redisClient.get(req.params.tropoid, function(err, result) {
            if(result === 'passed') {
                SignupProgress.setMinProgress(req, 'tropo', function () {
                    res.json({sessionId: req.params.tropoid, status: result});
                });
                return;
            }

            res.json({sessionId: req.params.tropoid, status: result});
        });
    });

    app.get('/countryCodes',function(req, res) {
      res.json(countryCodes);
    });

    app.get('/signup/:step', function (req, res) {
        SignupProgress.setMinProgress(req, req.params.step, function () {
            res.send(200);
        });
    });

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