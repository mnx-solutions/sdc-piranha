'use strict';

var fwrule = require('fwrule');

module.exports = function execute (scope) {
    var server = scope.api('Server');
    var utils = scope.get('utils');

    server.onCall('MachineFirewallEnable', {
        verify: function (data) {
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
                call.done(err);
            } else {
                call.done(null, rules);
            }
        });
    });

    server.onCall('RuleCreate', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('enabled') &&
                data.hasOwnProperty('parsed');
        },

        handler: function (call) {
            call.log.info('Create firewall rule');
            var cloud = call.cloud.separate(call.data.datacenter);

            cloud.createFwRule({
                enabled: call.data.enabled,
                rule: fwrule.create(call.data).text()
            }, function (err, rules) {
                if (err) {
                    setInterval(function () {
                        cloud.getFwRule(call.data.parsed.uuid, function () {
                           console.log(arguments);
                        });
                    }, 100);
                    call.log.error(err);
                    call.done(err);
                } else {
                    call.done(null, rules);
                }
            });
        }
    });

    server.onCall('RuleUpdate', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('enabled') &&
                data.hasOwnProperty('parsed');
        },

        handler: function (call) {
            call.log.info('Update firewall rule ' + call.data.uuid);
            var cloud = call.cloud.separate(call.data.datacenter);

            cloud.updateFwRule(call.data.uuid, {
                enabled: call.data.enabled,
                rule: fwrule.create(call.data).text()
            }, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(err);
                } else {
                    call.done(null, rules);
                }
            });
        }
    });

    server.onCall('RuleDelete', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('uuid');
        },

        handler: function (call) {
            var uuid = call.data.uuid;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Disable firewall rule ' + uuid);
            cloud.deleteFwRule(uuid, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(err);
                } else {
                    call.done(null, rules);
                }
            });
        }
    });

    server.onCall('RuleEnable', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('uuid');
        },

        handler: function (call) {
            var uuid = call.data.uuid;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Enable firewall rule ' + uuid);
            cloud.enableFwRule(uuid, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(err);
                } else {
                    call.done(err, rules);
                }
            });
        }
    });

    server.onCall('RuleDisable', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('uuid');
        },

        handler: function (call) {
            var uuid = call.data.uuid;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Disable firewall rule ' + uuid);
            cloud.disableFwRule(uuid, function (err, rules) {
                if (err) {
                    call.log.error(err);
                    call.done(err);
                } else {
                    call.done(null, rules);
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
                    rules: []
                };

                // Serialize rules
                rules.forEach(function (rule) {
                    rule.datacenter = name;
                    rule.parsed = fwrule.parse(rule.rule);
                    rule.uuid = rule.id;
                });

                if (err) {
                    call.log.error('List rules failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                    response.status = 'error';
                    response.error = err;
                } else {
                    response.rules = rules;

                    call.log.debug('List rules succeeded for datacenter %s', name);
                }

                console.log('PROGrESS!!!!');
                call.update(null, response);

                if (--count === 0) {
                    call.done();
                }
            });
        });

    });
};
