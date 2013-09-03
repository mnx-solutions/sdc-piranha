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
            var networksInfo = {};

            service.updateNetworks = function (datacenter) {
                if (!networks.job || networks.job.finished) {
                    networks.job = serverTab.call({
                        name:'NetworksList',
                        data: {datacenter: datacenter},
                        done: function(err, job) {
                            // FIXME: Next lines should be uncommented
                            /*
                            if (err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'machine',
                                    'Unable to retrieve networks list'
                                )));
                                return;
                            }
                            */
                            var result = job.__read();

                            networks.list = result;
                            networks.list.final = true;
                        }
                    });
                }

                return networks.job;
            };

            service.getNetwork = function(datacenter, id) {
                var d = $q.defer();
                if(networksInfo[datacenter] && networksInfo[datacenter][id]) {
                    d.resolve(networksInfo[datacenter][id]);
                } else {
                    var job = serverTab.call({
                        name: 'getNetwork',
                        data: {uuid: id, datacenter: datacenter},
                        done: function(err, job) {
                            var res = job.__read();

                            if(!networksInfo[datacenter])
                                networksInfo[datacenter] = {};

                            networksInfo[datacenter][id] = res;
                            d.resolve(res);
                        }
                    });
                }


                return d.promise;
            };

            service.network = function (datacenter) {
                if (datacenter === true || (datacenter && !networks.job) || (datacenter && networks.job.finished)) {
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