'use strict';


(function (ng, app) {
    app.factory('rule', [
        'serverTab',
        '$rootScope',
        '$q',
        'localization',
        'notification',

        function (serverTab, $rootScope, $q, localization, notification) {

            var service = {};
            var rules = { job: null, index: {}, map: {}, list: [], search: {} };

            service.createRule = function (rule) {
                rule.uuid = window.uuid.v4();

                // Store rule
                rules.list.push(rule);
                rules.index[rule.uuid] = rule;

                function showError (err) {
                    console.log('error');
                    console.log(err);
                    notification.push(rule.uuid, { type: 'error' },
                        localization.translate(null,
                            'firewall',
                            'Unable to a create rule: {{error}}',
                            {
                                error: (err.message) ? '<br />' + err.message : ''
                            }
                        )
                    );

                    rules.list.splice(rules.list.indexOf(rule), 1);
                    delete rules.index[rule.uuid];
                }

                // Create a new rule
                var job = serverTab.call({
                    name: 'RuleCreate',
                    data: rule,
                    done: function(err, job) {
                        if (err) {
                            showError(err);
                            return;
                        }

                        var data = job.__read();
                    },

                    error: function(err, job) {
                        if (err && Object.keys(err).length > 0) {
                            showError(err);
                            return;
                        }
                    }
                });

                rule.job = job.getTracker();
                return job;
            };

            service.updateState = function (action) {
                return function (rule) {
                    function showError (err) {
                        notification.push(rule.uuid, { type: 'error' },
                            localization.translate(null,
                                'firewall',
                                'Unable to update rule: {{error}}',
                                {
                                    error: (err.message) ? '<br />' + err.message : ''
                                }
                            )
                        );
                    }

                    // Create a new rule
                    var job = serverTab.call({
                        name: action || 'RuleUpdate',
                        data: rule,
                        done: function(err, job) {
                            if (err) {
                                showError(err);
                                return;
                            }

                            var data = job.__read();
                        },

                        error: function(err, job) {
                            if (err && Object.keys(err).length > 0) {
                                showError(err);
                                return;
                            }
                        }
                    });

                    rule.job = job.getTracker();
                    return job;
                }
            };

            service.updateRule = service.updateState('RuleUpdate');
            service.deleteRule = service.updateState('RuleDelete');
            service.enableRule = service.updateState('RuleEnable');
            service.disableRule = service.updateState('RuleDisable');

            service.rule = function (id) {
                if (id === true || (!id && !rules.job)) {
                    service.updateRules();
                    return rules.list;
                }

                if (!id) {
                    return rules.list;
                }

                if (!rules.index[id]) {
                    service.updateRules();
                }

                if (!rules.index[id] || (rules.job && !rules.job.finished)) {
                    if (!rules.search[id]) {
                        rules.search[id] = $q.defer();
                    }

                    return rules.search[id].promise;
                }

                return rules.index[id];
            };

            service.updateRules = function () {
                if (!rules.job || rules.job.finished) {
                    rules.list.final = false;
                    rules.job = serverTab.call({
                        name: 'RuleList',
                        progress: function (err, job) {
                            var data = job.__read();
                            var name = data.hasOwnProperty('name') ? data.name : null;

                            function handleChunk (rule) {
                                var old = null;

                                if (rules.index[rule.id]) {
                                    old = rules.list.indexOf(rules.index[rule.id]);
                                }

                                rules.index[rule.id] = rule;

                                if (rules.search[rule.id]) {
                                    rules.search[rule.id].resolve(rule);
                                    delete rules.search[rule.id];
                                }

                                if (old === null) {
                                    rules.list.push(rules);
                                } else {
                                    rules.list[old] = rule;
                                }

                                if (!rules.map[name]) {
                                    rules.map[name] = [];
                                }

                                rules.map[name].push(rule);
                            }

                            function handleResponse(chunk) {
                                if (chunk.status === 'error') {
                                    notification.push(chunk.name, { type: 'error' },
                                        localization.translate(null,
                                            'rule',
                                            'Unable to retrieve rules from datacenter {{name}}',
                                            { name: chunk.name }
                                        )
                                    );
                                    return;
                                }

                                if (chunk.rules) {
                                    chunk.rules.forEach(handleChunk);
                                }
                            }

                            if (ng.isArray(data)) {
                                data.forEach(handleResponse);
                            } else {
                                handleResponse(data);
                            }
                        },

                        done: function(err, job) {
                            rules.list.final = true;
                        }
                    });
                }

                return rules.job;
            };

            if (!rules.job) {
                service.updateRules();

                /*
                var rule = {
                    datacenter: 'us-beta-4',
                    enabled: true,
                    rule: 'FROM any TO any ALLOW tcp PORT 80',
                    parsed: {
                        from: [ [ 'wildcard', 'any' ] ],
                        to: [ [ 'wildcard', 'any' ] ],
                        action: 'allow',
                        protocol: { name: 'tcp', targets: [ 80 ] }
                    }
                };

                service.createRule(rule);
                */
            }

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
