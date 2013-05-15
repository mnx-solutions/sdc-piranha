'use strict';
(function (app) {
    app.factory('Zendesk', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',

        function (serverTab, $q, localization, notification, errorContext) {
            var service = {};

            var forums = false;
            var systemStatusTopics = false;
            var softwareUpdateTopics = false;



            service.getForumsList = function() {
                var deferred = $q.defer();

                if(!forums) {
                    serverTab.call({
                        name: 'ZendeskForumList',
                        progress: function(err, job) {
                        },
                        done: function(err, job) {
                            forums = job.__read();
                            deferred.resolve(forums);
                        }
                    });
                } else {
                    deferred.resolve(forums);
                }

                return deferred.promise;
            };


            service.getSystemStatusTopics = function() {
                var deferred = $q.defer();

                if(!systemStatusTopics) {
                    serverTab.call({
                        name: 'ZendeskSystemStatusTopics',
                        progress: function(err, job) {
                        },
                        done: function(err, job) {
                            systemStatusTopics = job.__read();
                            deferred.resolve(systemStatusTopics);
                        }
                    });
                } else {
                    deferred.resolve(forums);
                }

                return deferred.promise;
            }

            service.getSoftwareUpdateTopics = function() {
                var deferred = $q.defer();

                if(!systemStatusTopics) {
                    serverTab.call({
                        name: 'ZendeskPackagesUpdateTopics',
                        progress: function(err, job) {
                        },
                        done: function(err, job) {
                            softwareUpdateTopics = job.__read();
                            deferred.resolve(softwareUpdateTopics);
                        }
                    });
                } else {
                    deferred.resolve(forums);
                }

                return deferred.promise;
            }


            return service;
        }]);
}(window.JP.getModule('Dashboard')));
