'use strict';

var fwrule = require('fwrule');
var config = require('easy-config');

var firewall = function execute (scope) {
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
            cloud.enableFirewall(machineId, call.done.bind(call));
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
            cloud.disableFirewall(machineId, call.done.bind(call));
        }
    });

    server.onCall('MachineRuleList', function (call) {
        call.log.info('Retrieving firewall rules list');
        call.cloud.listMachineRules(machineId, call.done.bind(call));
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
            }, function (err, rule) {
                if (err) {
                    call.log.error(err);
                    call.done(err);
                } else {
                    // Poll for rule
                    var timeout = null;
                    var poll = setInterval(function () {
                        call.log.info('Polling firewall rule');

                        cloud.getFwRule(rule.id, function (err, rule) {
                            if (!err) {
                                call.done(null, rule);
                                clearInterval(poll);
                                clearTimeout(timeout);
                            }
                        });
                    }, 500);

                    // When timeout reached
                    timeout = setTimeout(function () {
                        var err = new Error('Rule not created');
                        call.log.error(err);
                        call.done(err);
                        clearInterval(poll);
                    }, 10000);
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
            }, call.done.bind(call));
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
            cloud.deleteFwRule(uuid, call.done.bind(call));
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
            cloud.enableFwRule(uuid, call.done.bind(call));
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
            cloud.disableFwRule(uuid, call.done.bind(call));
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

                call.update(null, response);

                if (--count === 0) {
                    call.done();
                }
            });
        });

    });
};

if (!config.features || config.features.firewall !== 'disabled') {
    module.exports = firewall;
}

