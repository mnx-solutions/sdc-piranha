'use strict';


(function (ng, app) {
    app.factory('rule', [
        'serverTab',
        'Dataset',
        '$rootScope',
        '$q',
        '$timeout',
        'localization',
        'util',
        'PopupDialog',

        function (serverTab, Dataset, $rootScope, $q, $timeout, localization, util, PopupDialog) {

            var service = {};
            var rules = { job: null, index: {}, map: {}, list: [], search: {} };

            function cleanRule(rule) {
                return util.clone(rule);
            }

            service.cleanRule = cleanRule;

            function removeRule(rule) {
                rules.list.splice(rules.list.map(function(el) { return el.uuid; }).indexOf(rule.uuid), 1);
                delete rules.index[rule.uuid];
                rules.map[rule.datacenter].splice(rules.map[rule.datacenter].map(function(el) { return el.uuid; }).indexOf(rule.uuid), 1);
            }

            function updateLocal(action, rule) {
                switch(action) {
                    case 'RuleEnable':
                        rules.index[rule.uuid].enabled = true;
                        break;
                    case 'RuleDisable':
                        rules.index[rule.uuid].enabled = false;
                        break;
                    case 'RuleDelete':
                        removeRule(rule);
                        break;
                    default:
                }
            }

            service.createRule = function (rule) {
                rule = cleanRule(rule);
                rule.uuid = window.uuid.v4();

                // Store rule
                rules.list.push(rule);
                rules.index[rule.uuid] = rule;
                if(!rules.map[rule.datacenter]) {
                    rules.map[rule.datacenter] = [];
                }
                rules.map[rule.datacenter].push(rule);

                function isDatacenterOn(callback) {
                    return Dataset.dataset({datacenter: rule.datacenter}).catch(function (err) {
                        return callback(null, err);
                    });
                }

                function showError(err) {
                    isDatacenterOn(function (err2, result) {
                        // add messages from errors to make it move convenient
                        var errMsg = (err.message) ? '<br />' + err.message : '';
                        if (err.body.errors && err.body.errors.length > 0) {
                            err.body.errors.forEach(function (error) {
                                errMsg += (error.message) ? '<br />' + error.message : '';
                            });
                        }
                        if (!!result.code) {
                            errMsg = errMsg + 'Datacenter ' + rule.datacenter + ' is currently not available. We are working on getting this datacenter back on';
                        }

                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'firewall',
                                'Unable to a create rule: {{error}}.',
                                {
                                    error: errMsg
                                }
                            ),
                            function () {
                            }
                        );

                        removeRule(rule);

                    });
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
                        delete rules.index[rule.uuid];
                        rule.uuid = data.id;
                        rules.index[rule.uuid] = rule;
                    },

                    error: function(err, job) {
                        if (err) {
                            showError(err);
                            return;
                        }
                    }
                });

                job.getTracker();
                return job.deferred;
            };

            service.updateState = function (action) {
                return function (rule) {
	                rule = cleanRule(rule);
                    function showError (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'firewall',
                                'Unable to update rule: {{error}}.',
                                {
                                    error: (err.message) ? '<br />' + err.message : ''
                                }
                            ),
                            function () {}
                        );
                    }

                    if(rule.job) {
                        delete rule.job;
                    }
                    // Update the rule
                    var job = serverTab.call({
                        name: action || 'RuleUpdate',
                        data: rule,
                        done: function(err, job) {
                            if (err) {
                                showError(err);
                                return;
                            }
                            updateLocal(action, rule);
                        },

                        error: function(err, job) {
                            if (err) {
                                showError(err);
                                return;
                            }
                        }
                    });

                    job.getTracker();
                    return job.deferred;
                };
            };

            service.deleteRule = service.updateState('RuleDelete');
            service.updateRule = service.updateState('RuleUpdate');
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
                        } else {
                            if (rules.job.finished) {
                                deferred.resolve(rules.map);
                            } else {
                                rules.job.deferred.then(function () {
                                    deferred.resolve(rules.map);
                                }, function (err) {
                                    deferred.reject(err);
                                });
                            }
                        }
                    } else if (!rules.index[id]) { //Rule
                        if (!rules.job) {
                            service.updateRules();
                        } else if (rules.job && !rules.job.finished) {
                            if (!rules.search[id]) {
                                rules.search[id] = $q.defer();
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
                        }
                    } else {
                        deferred.resolve(rules.index[id]);
                    }
                }, 0);

                return deferred.promise;
            };

            service.clearRules = function () {
                rules = { job: null, index: {}, map: {}, list: [], search: {} };
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
                                    PopupDialog.error(
                                        localization.translate(
                                            null,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            null,
                                            'rule',
                                            'Unable to retrieve rules from datacenter {{name}}.',
                                            { name: chunk.name }
                                        ),
                                        function () {}
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

            if (!rules.job && $rootScope.features.firewall === 'enabled') {
                service.updateRules();
            }

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
