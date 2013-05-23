'use strict';

var crypto = require('crypto');
var conf = require('easy-config');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var fs = require('fs');
var countryCodes = require('./data/countryCodes');


redisClient.auth(config.redis.password, function() {
    console.log('Redis auth in old-account-api');
});
/**
 * @ngdoc service
 * @name account.service:api
 * @requires $rootScope $q serverTab $$track
 *
 * @description
 * Account module API
 */
module.exports = function (scope, app, callback) {
    var keyGen = null;

    var SignupProgress = scope.api('SignupProgress');

    /**
     * @ngdoc method
     * @name account.function:api#/tropo/tropoid
     * @methodOf account.service:api
     *
     * @param {String} tropoid Tropo id
     *
     * @description
     * Get tropo id
     *
     */
    app.get('/tropo/:tropoid/:uuid', function(req, res) {
        // set no-cache headers for IE 10 fix
        res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');

        redisClient.get(req.params.tropoid, function(err, result) {
            console.log(arguments);
            var status = result;
            if(status === 'passed') {
                SignupProgress.setMinProgress(req, 'tropo', function () {
                    redisClient.get(req.params.uuid +'_tropo', function(err, result) {
                        res.json({sessionId: req.params.tropoid, status: status, retries: result});
                    });
                });
                return;
            }

            redisClient.get(req.params.uuid +'_tropo', function(err, result) {
                res.json({sessionId: req.params.tropoid, status: status, retries: result});
            });
        });
    });

    app.get('/tropoRetries/:uuid', function(req, res) {
        redisClient.get(req.params.uuid +'_tropo', function(err, result) {
            res.json({retries: result});
        });
    });

    app.get('/countryCodes',function(req, res) {
        var data = countryCodes.getArray(config.zuora.api.validation.countries);
        data.forEach(function (el) {
            if(['USA','CAN','GBR'].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/signup/skipSsh', function(req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function() {
            res.redirect('/main');
        });
    });

    app.get('/changepassword/:uuid', function (req, res, next) {
        res.redirect(config.sso.url + '/changepassword/' + req.params.uuid);
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