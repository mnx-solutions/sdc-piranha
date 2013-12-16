'use strict';

var manta = require('manta');
var fs = require('fs');
var config = require('easy-config');

function createClient(call, callback) {
    var client = manta.createClient({
        sign: manta.privateKeySigner({
            key: fs.readFileSync(config.manta.privateKey, 'utf8'),
            keyId: config.manta.keyId,
            user: config.manta.user || call.req.session.username
        }),
        user: config.manta.user || call.req.session.username,
        url: config.manta.url
    });

    callback(null, client);
}

module.exports = function execute(scope) {
    var server = scope.api('Server');

    server.onCall('JobList', function (call) {
        createClient(call, function (clientErr, client) {
            if (clientErr) {
                call.done(clientErr);
                return;
            }
            client.jobs(function (jobsErr, res) {
                if (jobsErr) {
                    call.done(jobsErr);
                    return;
                }
                var jobs = [];
                res.on('job', function (job) {
                    jobs.push(job);
                });
                res.on('end', function () {
                    call.done(null, jobs);
                });
            });
        });
    });
};