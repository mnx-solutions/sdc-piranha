
'use strict';

var crypto = require('crypto');
var config = require('easy-config');
var fs = require('fs');
var countryCodes = require('./data/country-codes');
var exec = require('child_process').exec;
var os = require('os');
var uuid = require('../../static/vendor/uuid/uuid.js');
var jobs = {};

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
        var data = countryCodes.getArray(config.zuora.rest.validation.countries);
        data.forEach(function (el) {
            if(['USA','CAN','GBR'].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/signup/:step', function(req, res) {
        req.session.allowSignup = true;
        res.redirect('/signup/#!/'+ req.params.step);
    });

    app.get('/signup/skipSsh', function(req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function() {
            scope.log.info('User skipped SSH step');
            res.json({success:true});
        });
    });

    app.get('/signup/passSsh', function(req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function() {
            scope.log.info('User passed SSH step');
            res.json({success:true});
        });
    });

    app.get('/changepassword/:uuid', function (req, res, next) {
        res.redirect(config.sso.url + '/changepassword/' + req.params.uuid);
    });

    /* SSH keys logic */
    app.post('/ssh/create/:name?', function(req, res, next) {
        var jobId = uuid.v4();
        jobs[jobId] = {status: 'pending'};

        // generate 2048 bit rsa key and add public part to cloudapi
        var randomBytes = crypto.randomBytes(4).readUInt32LE(0);
        var filePath = os.tmpdir() +'/'+ randomBytes;
        var name = (req.body.name || crypto.createHash('sha1').update(filePath).digest('hex').substr(0, 10));
        var cmd = 'ssh-keygen -t rsa -q -f ' + filePath + ' -N "" -C "' + req.session.userName +'" && cat ' + filePath +'.pub';


        req.log.debug('Generating SSH key pair');

        exec(cmd, function(err, stdout, stderr) {

            jobs[jobId].filePath = filePath;
            jobs[jobId].name = name;
            jobs[jobId].fileName = randomBytes;

            req.log.debug('Adding SSH key to the account');

            SignupProgress.addSshKey(req, name, stdout, function(err) {
                if (err) {
                    req.log.error(err);
                    res.json({success: false, jobId: jobId, err: err});
                    return;
                }

                // start unlink timeout
                // if file hasn't been deleted within 2 minutes, it will get deleted here
                setTimeout(function() {
                    fs.exists(filePath, function(exists) {
                        if(exists) {
                            fs.unlink(filePath, function(err) {
                                if(err) {
                                    req.log.error(err);
                                }
                            });
                        }

                    });
                }, (2 * 60 * 1000));


                // success
                req.log.debug('Added SSH key to the account');
                res.json({success: true, jobId: jobId, keyId: randomBytes, name: name});
            });

        });
    });

    app.get('/ssh/job/:jobId', function(req, res, next) {
        if(jobs[req.params.jobId]) {
            res.json(jobs[req.params.jobId]);
        } else {
            res.send(404);
        }
    });


    app.get('/ssh/download/:jobId', function(req, res, next) {
        var jobId = req.params.jobId;

        if(!jobs[jobId]) {
            jobs[jobId] = {
                error: 'Invalid SSH key requested',
                success: false,
                status: 'finished'
            };
            req.log.error('Invalid SSH key requested');
            return;
        }

        var filePath = jobs[jobId].filePath;

        // file name for download
        var fileName = (jobs[jobId].name || jobs[jobId].fileName) +'_id_rsa';

        fs.readFile(filePath, {encoding: 'UTF8'}, function(err, data) {
            if(err) {
                jobs[jobId] = {
                    error: 'Internal error',
                    success: false,
                    status: 'finished'
                };
                req.log.error(err);
                return;
            }

            res.set('Content-type', 'application/x-pem-file');
            res.set('Content-Disposition', 'attachment; filename="'+ fileName +'"');
            res.send(data);

            fs.unlink(filePath, function(err) {
                if(err) {
                    req.log.error(err);
                }
            });

            jobs[jobId] = {
                error: null,
                success: true,
                status: 'finished'
            };
        });
    });
};