var fs = require('fs');
var csv = require('csv');
var async = require('async');

var results = {};

fs.readFile((process.argv[2] || __dirname +'/jpc-cn-reboots.csv'), function(err, data) {
    csv()
        .from.string(data)
        .to.array(function (data) {
            async.each(data, function(result, cb) {
                results[result[3]] = {
                    "maintenanceStartTime": result[0]
                };

                cb(null);
            }, function(err) {
                fs.writeFile('instances.json', JSON.stringify(results, null, 4));
            });
        });
});