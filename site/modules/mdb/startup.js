'use strict';
var config = require('easy-config');
var restify = require('restify');
var path = require('path');

function objectsParser(data) {
    var result = {total: {}, data: []};
    var i, tmp;
    data = data.split(/\n/);
    for (i = 0; i < data.length; i += 1) {
        tmp = data[i];
        if (tmp.indexOf('findjsobjects:') === 0) {
            tmp = /\s*[^:]+:\s*(.*) => (\d+).*$/.exec(tmp);
            if (tmp) {
                result.total[tmp[1]] = parseInt(tmp[2], 10);
            }
        } else {
            tmp = /\s*([0-9a-f]+)\s*(\d+)\s*(\d+)\s*(.*)/.exec(tmp);
            if (tmp) {
                result.data.push({
                    object: tmp[1],
                    objects: tmp[2],
                    props: tmp[3],
                    constructor: tmp[4]
                });
            }
        }
    }
    return result;
}

var mdb = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    server.onCall('mdbProcess', function (call) {
        var client = Manta.createClient(call);
        console.log('Job started!');
        call.update(null, 'Starting');
        client.createJob({
            phases: [{
                type: 'map',
                assets: [config.mdb.processor],
                exec: 'bash /assets/' + config.mdb.processor + ' | mdb $MANTA_INPUT_FILE'
            }]
        }, function (error, jobId) {
            if (error) {
                call.error(error);
                return;
            }
            client.addJobKey(jobId, call.data.coreFile, {end: true}, function (error, result) {
                console.log(jobId, error);
                call.update(null, 'Processed');
                call.done(null);
            });
        });
    });
};

if (!config.features || config.features.mdb !== 'disabled') {
    module.exports = mdb;
}