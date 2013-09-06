'use strict';

var fwrule = require('fwrule');

module.exports = function execute (scope) {
    var server = scope.api('Server');
    var utils = scope.get('utils');

    server.onCall('MachineFirewallEnable', {
        verify: function (data) {
            console.log(data);
            return data && data.hasOwnProperty('machineId');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Enabling firewall for machine %s', machineId);
            cloud.enableFirewall(machineId, function (err) {
                if (!err) {
                    call.done();
                } else {
                    call.log.error(err);
                    call.error(err);
                }
            });
        }
    });

    server.onCall('MachineFirewallDisable',  {
        verify: function (data) {
            return data && data.hasOwnProperty('machineId');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Disabling firewall for machine %s', machineId);
            cloud.disableFirewall(machineId, function (err) {
                if (!err) {
                    call.done();
                } else {
                    call.log.error(err);
                    call.error(err);
                }
            });
        }
    });

    server.onCall('MachineRuleList', function (call) {
        call.log.info('Retrieving firewall rules list');
        call.cloud.listMachineRules(machineId, function (err, rules) {
            if (err) {
                call.log.error(err);
                call.done(null, err);
            } else {
                call.done(rules);
            }
        });
    });

    server.onCall('RuleCreate', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('enabled') &&
                data.hasOwnProperty('rule');
        },

        handler: function (call) {
            call.log.info('Create firewall rule');
            call.cloud.createFwRule({
                enabled: call.data.enabled,
                rule: call.data.rule
            }, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(null, err);
                } else {
                    call.done(rules);
                }
            });
        }
    });

    server.onCall('RuleDelete', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('ruleId');
        },

        handler: function (call) {
            var ruleId = call.data.ruleId;

            call.log.info('Disable firewall rule ' + ruleId);
            call.cloud.deleteFwRule(ruleId, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(null, err);
                } else {
                    call.done(rules);
                }
            });
        }
    });

    server.onCall('RuleEnable', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('ruleId');
        },

        handler: function (call) {
            var ruleId = call.data.ruleId;

            call.log.info('Enable firewall rule ' + ruleId);
            call.cloud.enableFwRule(ruleId, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(null, err);
                } else {
                    call.done(rules);
                }
            });
        }
    });

    server.onCall('RuleDisable', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('ruleId');
        },

        handler: function (call) {
            var ruleId = call.data.ruleId;

            call.log.info('Disable firewall rule ' + ruleId);
            call.cloud.disableFwRule(ruleId, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(null, err);
                } else {
                    call.done(rules);
                }
            });
        }
    });

    /* listFwRules && listMachineRules */
    server.onCall('RuleList', function (call) {
        call.log.info('Handling rule list event');

        var datacenters = call.cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            var cloud = call.cloud.separate(name);
            call.log.debug('List rules for datacenter %s', name);
            cloud.listFwRules(function (err, rules) {
                var response = {
                    name: name,
                    status: 'pending',
                    rules: []
                };

                // Serialize rules
                rules.forEach(function (rule) {
                    rule.serialized = fwrule.parse(rule.rule);
                });

                if (err) {
                    call.log.error('List rules failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                    response.status = 'error';
                    response.error = err;
                } else {
                    response.rules = rules;

                    call.log.debug('List rules succeeded for datacenter %s', name);
                }

                call.update(null, response);

                if (--count === 0) {
                    call.done();
                }
            });
        });

    });
};
