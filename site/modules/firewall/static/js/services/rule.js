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
            var rule = { job: null, index: {}, list: [], search: {} };

            service.updateRules = function () {
                console.log('updateRules');
                if (!rule.job || rule.job.finished) {
                    rule.list.final = false;
                    rule.job = serverTab.call({
                        name: 'RuleList',
                        progress: function (err, job) {
                            var data = job.__read();

                            function handleChunk (rule) {
                                /*
                                var old = null;

                                if (rule.index[machine.id]) {
                                    old = rule.list.indexOf(rule.index[machine.id]);
                                }

                                rule.index[machine.id] = machine;

                                if (rule.search[machine.id]) {
                                    rule.search[machine.id].resolve(machine);
                                    delete rule.search[machine.id];
                                }

                                if (old === null) {
                                    rule.list.push(machine);
                                } else {
                                    rule.list[old] = machine;
                                }
                                */
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
                            console.log(arguments);
                            rule.list.final = true;
                        }
                    });
                }

                return rule.job;
            };

            service.updateRules();

            return service;
        }]);
}(window.angular, window.JP.getModule('firewall')));
