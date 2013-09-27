'use strict';

var crypto = require('crypto');
var conf = require('easy-config');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var fs = require('fs');
var countryCodes = require('./data/country-codes');
var exec = require('child_process').exec;
var os = require('os');

redisClient.auth(config.redis.password, function() {});
/**
 * @ngdoc service
 * @name account.service:api
 * @requires $rootScope $q serverTab $$track
 *
 * @description
 * Account module API
 */
module.exports = function execute(scope, app) {
    var keyGen = null;

    var SignupProgress = scope.api('SignupProgress');

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

    app.get('/ssh/:name?', function(req, res, next) {
        // generate 2048 bit rsa key and send private key to the user
        var filePath = os.tmpdir() +'/'+ crypto.randomBytes(4).readUInt32LE(0);
        var name = (req.params.name || crypto.createHash('sha1').update(filePath).digest('hex').substr(0, 10));
        scope.log.debug('Generating ssh key pair for user '+ req.session.userId);
        exec('ssh-keygen -t rsa -q -f '+ filePath +' -N "" -C "'+ req.session.userName +'" && cat '+ filePath +'.pub', function(err, stdout, stderr) {
            SignupProgress.addSshKey(req, name, stdout, function(err) {
                if(err) {
                    scope.log.error(err);
                    return;
                }

                fs.readFile(filePath, {encoding: 'UTF8'}, function(err, data) {
                    if(err) {
                        scope.log.error(err);
                        return;
                    }

                    res.set('Content-type', 'application/x-pem-file');
                    res.set('Content-Disposition', 'attachment; filename="'+ name +'_id_rsa"');
                    res.send(data);

                    fs.unlink(filePath, function(err) {
                        if(err) {
                            scope.log.error(err);
                            return;
                        }
                    });
                });
            });

        });
    });
};