'use strict';

(function (app) {
    app.factory('Network', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',

        function (serverTab, $q) {

            var service = {};
            var networks = { job: {}, index: {}, list: {}, error: {}};
            var networksInfo = {};

            service.updateNetworks = function (datacenter) {

                if (!networks.job[datacenter] || networks.job[datacenter].finished) {
                    networks.job[datacenter] = null;
                    networks.list[datacenter] = [];

                    networks.job[datacenter] = serverTab.call({
                        name: 'NetworksList',
                        data: {datacenter: datacenter},
                        error: function (err) {
                            networks.error[datacenter] = err;
                        },
                        done: function (err, job) {
                            if (err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'machine',
                                    'Unable to retrieve networks list'
                                )));
                                return;
                            }
                            var result = job.__read();

                            networks.list[datacenter] = result;
                            networks.list[datacenter].final = true;
                        }
                    });
                }

                return networks.job[datacenter];
            };

            service.getNetwork = function (datacenter, id) {
                var d = $q.defer();
                if (networksInfo[datacenter] && networksInfo[datacenter][id]) {
                    d.resolve(networksInfo[datacenter][id]);
                } else {
                    serverTab.call({
                        name: 'getNetwork',
                        data: {uuid: id, datacenter: datacenter},
                        error: function (err) {
                            d.reject(err);
                        },
                        done: function (err, job) {
                            var res = job.__read();

                            if (!networksInfo[datacenter]) {
                                networksInfo[datacenter] = {};
                            }

                            networksInfo[datacenter][id] = res;
                            d.resolve(res);
                        }
                    });
                }


                return d.promise;
            };

            service.network = function (datacenter) {
                if (datacenter === true || (datacenter && !networks.job[datacenter]) || (datacenter && networks.job[datacenter].finished)) {
                    var job = service.updateNetworks(datacenter);
                    return job.promise;
                }

                var ret = $q.defer();

                if (datacenter) {
                    if (networks.list[datacenter].final) {
                        ret.resolve(networks.list[datacenter]);
                    } else {
                        networks.job[datacenter].promise.then(function () {
                            ret.resolve(networks.list[datacenter]);
                        });
                    }
                }

                return ret.promise;
            };

            service.networks = function () {
                return networks.list.length > 0 ? networks.list : null;
            };

            return service;
        }]);
}(window.JP.getModule('Machine')));