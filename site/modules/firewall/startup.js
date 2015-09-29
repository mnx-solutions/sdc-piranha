'use strict';

var fwrule = require('fwrule');
var config = require('easy-config');
var vasync = require('vasync');

var firewall = function execute (api, config) {
    var server = require('../server').Server;
    var Machine = require('../machine').Machine;
    var utils = require('../../../lib/utils');

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
                    call.done(err);
                } else {
                    // Serialize rules
                    var parsedRules = [];
                    rules.forEach(function (rule) {
                        rule.uuid = rule.id;

                        try {
                            rule.parsed = fwrule.parse(rule.rule);
                        } catch (e) {
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
                    if (error) {
                        error = checkRuleStatusError(call, error);
                        if (error.isPermissionRelated) {
                            errorMessage = error.message;
                        }
                    }
                    call.done(error && errorMessage, !error && result || error && error.isPermissionRelated);
                }
            }, null, true);
        }
        getRule();
    }

    function checkSuppressError(call, error) {
        var suppressError = false;
        if (error.message === 'rule does not affect VMs') {
            suppressError = true;
            call.log.info(error.message);
        }
        return suppressError;
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
            var description = call.data.description;
            var newRule;
            try {
                newRule = fwrule.create(call.data);
            } catch (e) {
                call.done(e.message, checkSuppressError(call, e));
                return;
            }
            newRule = newRule.text();
            cloud.createFwRule({
                enabled: call.data.enabled,
                rule: newRule,
                description: description
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
            var description = call.data.description;
            var newRule;
            try {
                newRule = fwrule.create(call.data);
            } catch (e) {
                call.done(e, checkSuppressError(call, e));
                return;
            }
            newRule = newRule.text();
            cloud.updateFwRule(uuid, {
                enabled: call.data.enabled,
                rule: newRule,
                description: description
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
                    return error && error.statusCode >= 400 && error.statusCode < 500;
                }, 'Rule not deleted');
            });
        }
    });

    function checkRuleStatusError(call, error) {
        if (typeof (error) === 'string') {
            error = {message: error};
        }
        var message = error.message;
        error.isPermissionRelated = message.indexOf('permission') !== -1;
        if (error.isPermissionRelated) {
            if (!/(enablefirewallrule|disablefirewallrule)/.test(message)) {
                message = error.message = 'Can\'t get status for rule. ' + message;
            }
            call.log.info(message);
        }
        return error;
    }

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
            cloud.enableFwRule(uuid, function (error, result) {
                error = error && checkRuleStatusError(call, error);
                call.done(error, result);
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
            cloud.disableFwRule(uuid, function (error, result) {
                error = error && checkRuleStatusError(call, error);
                call.done(error, result);
            });
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
            vasync.forEachParallel({
                inputs: Object.keys(datacenters || {}),
                func: function (name, callback) {
                    var cloud = call.cloud.separate(name);
                    call.log.debug('List rules for data center %s', name);

                    cloud.listFwRules(function (err, rules) {
                        var response = {
                            name: name,
                            status: 'pending',
                            rules: []
                        };

                        if (err) {
                            if (err.statusCode !== 403 || err.name !== 'NotAuthorizedError') {
                                call.log.error('List rules failed for data center %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                            }
                            response.status = 'error';
                            response.error = err;
                            if (err.restCode === 'NotAuthorized') {
                                callback(err);
                                return;
                            }
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

                            call.log.debug('List rules succeeded for data center %s', name);
                            response.status = 'complete';
                        }
                        call.update(null, response);
                        callback();
                    }, undefined, true);
                }
            }, function (vasyncErrors) {
                call.done(utils.getVasyncData(vasyncErrors).error);
            });
        }, !!call.req.session.subId);

    });
};

if (!config.features || config.features.firewall !== 'disabled') {
    module.exports = firewall;
}
