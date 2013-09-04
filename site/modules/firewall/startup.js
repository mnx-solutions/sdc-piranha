'use strict';

module.exports = function execute (scope) {
    var server = scope.api('Server');
    var utils = scope.get('utils');

    /* listFwRules && listMachineRules */
    server.onCall('RulesList', function (call) {
        var listMethod = call.cloud.listFwRules; // Default method

        // If machine id is set
        if (call.data.machineId) {
            listMethod = (function (cb) {
                call.cloud.listMachineRules(machineId, cb);
            });
        }

        call.log.info('Retrieving firewall rules list');
        listMethod(function (err, rules) {
            if (err) {
                call.log.error(err);
                call.done(null, err);
            } else {
                call.done(rules);
            }
        });
    });
};
