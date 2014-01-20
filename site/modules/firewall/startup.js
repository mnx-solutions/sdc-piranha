'use strict';

var fwrule = require('fwrule');
var config = require('easy-config');

var firewall = function execute (scope) {
    var server = scope.api('Server');
    var Machine = scope.api('Machine');
    var utils = scope.get('utils');

    server.onCall('MachineFirewallEnable', {
        verify: function (data) {
            return data
                && data.hasOwnProperty('machineId')
                && data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
            Machine.enableFirewall(call, call.done.bind(call));
        }
    });

    server.onCall('MachineFirewallDisable',  {
        verify: function (data) {
            return data
                && data.hasOwnProperty('machineId')
                && data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
            Machine.disableFirewall(call, call.done.bind(call));
        }
    });

    server.onCall('MachineRuleList', {
        verify: function (data) {
            return data && data.hasOwnProperty('machineId');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            var cloud = call.cloud.separate(call.data.datacenter);

            call.log.info('Retrieving firewall rules list for machine %s', machineId);
            cloud.listMachineRules(machineId, function (err, rules) {
                if (err) {
                    call.log.debug('Unable to list firewall rules for machine %s', machineId);
                    call.log.error(err);
                    call.done(err);
                } else {
                    // Serialize rules
                    rules.forEach(function (rule) {
                        rule.parsed = fwrule.parse(rule.rule);
                        rule.uuid = rule.id;
                    });

                    call.log.debug('List rules succeeded for machine %s', machineId);
                    call.done(null, rules);
                }
            });
        }
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
                    call.done(err);
                    return;
                }
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
                    }, undefined, true);
                }, 2000);

                // When timeout reached
                timeout = setTimeout(function () {
                    call.done(new Error('Rule not created'));
                    clearInterval(poll);
                }, 20000);
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
            var uuid = call.data.uuid;
            var newRule = fwrule.create(call.data).text();

            cloud.updateFwRule(uuid, {
                enabled: call.data.enabled,
                rule: newRule
            }, function (err, rule) {
                if (err) {
                    call.done(err);
                    return;
                }
                // Poll for rule
                var timeout = null;
                var poll = setInterval(function () {
                    call.log.info('Polling firewall rule');
                    cloud.getFwRule(uuid, function (err, rule) {
                        if (rule && rule.rule === newRule) {
                            call.done(null, rule);
                            clearInterval(poll);
                            clearTimeout(timeout);
                        }
                    }, undefined, true);
                }, 2000);

                // When timeout reached
                timeout = setTimeout(function () {
                    call.done(new Error('Rule not updated'));
                    clearInterval(poll);
                }, 90000);
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

            call.log.info('Delete firewall rule ' + uuid);
            cloud.deleteFwRule(uuid, function (err, rule) {
                if (err) {
                    call.done(err);
                    return;
                }
                // Poll for rule
                var timeout = null;
                var poll = setInterval(function () {
                    call.log.info('Polling firewall rule');
                    cloud.getFwRule(uuid, function (err, rule) {
                        if (err && err.statusCode === 404) {
                            call.done(null, rule);
                            clearInterval(poll);
                            clearTimeout(timeout);
                        }
                    }, undefined, true);
                }, 2000);

                // When timeout reached
                timeout = setTimeout(function () {
                    call.done(new Error('Rule not deleted'));
                    clearInterval(poll);
                }, 90000);
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

                if (err) {
                    call.log.error('List rules failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                    response.status = 'error';
                    response.error = err;
                } else {
                    response.rules = rules;

                    // Serialize rules
                    rules.forEach(function (rule) {
                        rule.datacenter = name;
                        rule.parsed = fwrule.parse(rule.rule);
                        rule.uuid = rule.id;
                    });

                    call.log.debug('List rules succeeded for datacenter %s', name);
                }

                call.update(null, response);

                if (--count === 0) {
                    call.done();
                }
            }, undefined, true);
        });

    });
};

if (!config.features || config.features.firewall !== 'disabled') {
    module.exports = firewall;
}

