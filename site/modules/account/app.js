'use strict';

var crypto = require('crypto');
var config = require('easy-config');
var fs = require('fs');
var countryCodes = require('./data/country-codes');
var exec = require('child_process').exec;
var os = require('os');

/**
 * @ngdoc service
 * @name account.service:api
 * @requires $rootScope $q serverTab $$track
 *
 * @description
 * Account module API
 */
module.exports = function execute(scope, app) {

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

    app.post('/ssh/create/:name?', function(req, res, next) {
        // generate 2048 bit rsa key and add public part to cloudapi
        var randomBytes = crypto.randomBytes(4).readUInt32LE(0);
        var filePath = os.tmpdir() +'/'+ randomBytes;
        var name = (req.body.name || crypto.createHash('sha1').update(filePath).digest('hex').substr(0, 10));
        scope.log.debug('Generating ssh key pair for user '+ req.session.userId);
        exec('ssh-keygen -t rsa -q -f '+ filePath +' -N "" -C "'+ req.session.userName +'" && cat '+ filePath +'.pub', function(err, stdout, stderr) {
            SignupProgress.addSshKey(req, name, stdout, function(err) {
                if(err) {
                    scope.log.error(err);
                    res.json({success: false, err: err});
                    return;
                }

                // start unlink timeout
                // if file hasn't been deleted within 2 minutes, it will get deleted here
                setTimeout(function() {
                    fs.exists(filePath, function(exists) {
                        if(exists) {
                            fs.unlink(filePath, function(err) {
                                if(err) {
                                    scope.log.error(err);
                                    return;
                                }
                            });
                        }

                    });
                }, (2 * 60 * 1000));


                // success
                res.json({success: true, keyId: randomBytes, name: name});
            });

        });
    });


    app.get('/ssh/download/:hash/:name?', function(req, res, next) {
        var hash = req.params.hash;
        var name = req.params.name;
        var filePath = os.tmpdir() +'/'+ hash;

        if(!hash) {
            scope.log.error('Invalid SSH key requested');
            return;
        }

        fs.readFile(filePath, {encoding: 'UTF8'}, function(err, data) {
            if(err) {
                scope.log.error(err);
                return;
            }

            res.set('Content-type', 'application/x-pem-file');
            res.set('Content-Disposition', 'attachment; filename="'+ (name || hash) +'_id_rsa"');
            res.send(data);

            fs.unlink(filePath, function(err) {
                if(err) {
                    scope.log.error(err);
                    return;
                }
            });
        });
    });
};