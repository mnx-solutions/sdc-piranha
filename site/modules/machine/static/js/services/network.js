'use strict';

(function (app) {
    app.factory('Network', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',

        function (serverTab, $q, localization, notification, errorContext) {

            var service = {};
            var networks = { job: null, index: {}, list: []};

            service.updateNetworks = function (datacenter) {
                if (!networks.job || networks.job.finished) {
                    networks.job = serverTab.call({
                        name:'NetworksList',
                        data: {datacenter: datacenter},
                        done: function(err, job) {
                            if (err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'machine',
                                    'Unable to retrieve networks list'
                                )));
                                return;
                            }

                            var result = job.__read();

                            networks.list = result;
                            networks.list.final = true;
                        }
                    });
                }

                return networks.job;
            };

            service.network = function (datacenter) {
                if (datacenter === true || (!datacenter && !networks.job)) {
                    var job = service.updateNetworks(datacenter);
                    return job.deferred;
                }

                var ret = $q.defer();
                if (!datacenter) {
                    if (networks.list.final) {
                        ret.resolve(networks.list);
                    } else {
                        networks.job.deferred.then(function () {
                            ret.resolve(networks.list);
                        });
                    }
                }

                return ret.promise;
            };

            service.networks = function () {
                return networks.list.length > 0 ? networks.list : null;
            };

//            if(!networks.job) {
//                // run updatePackages
//                service.updateNetworks(null);
//            }

            return service;
        }]);
}(window.JP.getModule('Machine')));