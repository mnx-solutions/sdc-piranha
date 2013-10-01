'use strict';


(function (ng, app) {
    app.factory('rule', [
        'serverTab',
        '$rootScope',
        '$q',
        '$timeout',
        'localization',
        'notification',

        function (serverTab, $rootScope, $q, $timeout, localization, notification) {

            var service = {};
            var rules = { job: null, index: {}, map: {}, list: [], search: {} };

            service.createRule = function (rule) {
                rule.uuid = window.uuid.v4();

                // Store rule
                rules.list.push(rule);
                rules.index[rule.uuid] = rule;
                rules.map[rule.datacenter].push(rule);

                function showError (err) {
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
                        rule.uuid = data.id;
                    },

                    error: function(err, job) {
                        if (err) {
                            showError(err);
                            return;
                        }
                    }
                });

                rule.job = job.getTracker();
                return job.deferred;
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
                            if (err) {
                                showError(err);
                                return;
                            }
                        }
                    });

                    rule.job = job.getTracker();
                    return job.deferred;
                }
            };

            service.updateRule = service.updateState('RuleUpdate');
            service.deleteRule = service.updateState('RuleDelete');
            service.enableRule = service.updateState('RuleEnable');
            service.disableRule = service.updateState('RuleDisable');

            service.rule = function (id) {
                var deferred = $q.defer();

                $timeout(function () {
                    // Map
                    if (!id) {
                        if (!rules.job) {
                            service.updateRules().then(function () {
                                deferred.resolve(rules.map);
                            }, function (err) {
                                deferred.reject(err);
                            });
                        }

                        if (rules.job && !rules.job.finished) {
                            rules.job.deferred.then(function () {
                                deferred.resolve(rules.map);
                            }, function (err) {
                                deferred.reject(err);
                            });
                        } else if (rules.job && rules.job.finished) {
                            deferred.resolve(rules.map);
                        }
                    }

                    // Rule
                    if (!rules.index[id]) {
                        if (!rules.job) {
                            service.updateRules();
                        }

                        if (rules.job && !rules.job.finished) {
                            if (!rules.search[id]) {
                                rules.search[id] = $q.defer();
                            }

                            // Reject/resolve search promise automatically (10s)
                            var resolver = $timeout(function () {
                                deferred.reject(new Error('Rule not found'));
                                $timeout.cancel(resolver);
                            }, 10000);

                            // Wrap promise handler
                            rules.search[id].promise.then(function () {
                                deferred.resolve(rules.index[id]);
                                $timeout.cancel(resolver);
                            }, function (err) {
                                deferred.reject(err);
                                $timeout.cancel(resolver);
                            });
                        } else {
                            deferred.reject(new Error('Rule not found'));
                        }
                    } else {
                        deferred.resolve(rules.index[id]);
                    }
                }, 0);

                return deferred.promise;
            };

            service.updateRules = function () {
                if (!rules.job || rules.job.finished) {
                    rules.list.final = false;
                    rules.job = serverTab.call({
                        name: 'RuleList',
                        progress: function (err, job) {
                            var data = job.__read();

                            function handleChunk (name, rule) {
                                var old = null;

                                if (rules.index[rule.id]) {
                                    old = rules.list.indexOf(rules.index[rule.id]);
                                }

                                rules.index[rule.id] = rule;

                                if (rules.search[rule.id]) {
                                    rules.search[rule.id].resolve(rule);
                                    delete rules.search[rule.id];
                                }

                                if (!rules.map[name]) {
                                    rules.map[name] = [];
                                }

                                if (old === null) {
                                    rules.list.push(rule);
                                    rules.map[name].push(rule);
                                } else {
                                    rules.list[old] = rule;
                                }
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
                                    chunk.rules.forEach(function (rule) {
                                        handleChunk(chunk.name, rule);
                                    });
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

                return rules.job.deferred;
            };

            if (!rules.job) {
                service.updateRules();
            }

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
