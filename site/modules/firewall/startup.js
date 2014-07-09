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
                    var parsedRules = [];
                    rules.forEach(function (rule) {
                        rule.uuid = rule.id;

                        try {
                            rule.parsed = fwrule.parse(rule.rule);
                        } catch(e) {
                            call.log.error(rule.rule, 'Failed to parse fwrule in machine fw list');
                            return;
                        }

                        parsedRules.push(rule);
                    });

                    call.log.debug('List rules succeeded for machine %s', machineId);
                    call.done(null, parsedRules);
                }
            });
        }
    });

    function fwPoller(call, uuid, timeout, condition, errorMessage) {
        var start = new Date().getTime();
        var cloud = call.cloud.separate(call.data.datacenter);
        condition = condition || function (err) { return !err; };
        function getRule() {
            cloud.getFwRule(uuid, function (error, result) {
                if (condition(error, result)) {
                    call.done(null, result);
                } else if (new Date().getTime() - start < timeout) {
                    setTimeout(getRule, config.polling.firewallRuleCheckingDelay);
                } else {
                    call.done(error && errorMessage, !error && result);
                }
            }, null, true);
        }
        getRule();
    }

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
                fwPoller(call, rule.id, config.polling.firewallRuleCreateTimeout, null, 'Rule not created');
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
                fwPoller(call, uuid, config.polling.firewallRuleUpdateTimeout, function (error, rule) {
                    return !error && rule && rule.rule === newRule;
                }, 'Rule not updated');
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
            cloud.deleteFwRule(uuid, function (err) {
                if (err) {
                    call.done(err);
                    return;
                }
                fwPoller(call, uuid, config.polling.firewallRuleDeleteTimeout, function (error) {
                    return error && error.statusCode === 404;
                }, 'Rule not deleted');
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

        call.cloud.listDatacenters(function (err, datacenters) {
            if (err) {
                call.done(err);
                return;
            }
            var keys = Object.keys(datacenters || {});
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

                    if (err) {
                        call.log.error('List rules failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                        response.status = 'error';
                        response.error = err;
                    } else {
                        // Serialize rules
                        rules.forEach(function (rule) {
                            rule.datacenter = name;
                            rule.uuid = rule.id;

                            try {
                                rule.parsed = fwrule.parse(rule.rule);
                            } catch (e) {
                                call.log.error(rule.rule, 'Failed to parse fwrule');
                                return;
                            }

                            response.rules.push(rule);
                        });

                        call.log.debug('List rules succeeded for datacenter %s', name);
                        response.status = 'complete';
                    }
                    call.update(null, response);

                    if (--count === 0) {
                        call.done();
                    }
                }, undefined, true);
            });
        }, !!call.req.session.subId);

    });
};

if (!config.features || config.features.firewall !== 'disabled') {
    module.exports = firewall;
}

