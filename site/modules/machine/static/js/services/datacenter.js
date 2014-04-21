'use strict';

(function (app) {
    app.factory('Datacenter', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',

        function (serverTab, $q, localization, notification, errorContext) {

        var service = {};
        var datacenters = { job: null, index: {}, list: [], search: {} };

        service.updateDatacenters = function () {
            if (!datacenters.job || datacenters.job.finished) {
                datacenters.job = serverTab.call({
                    name:'DatacenterList',
                    done: function(err, job) {
                        if (err) {
                            errorContext.emit(new Error(localization.translate(null,
                                'machine',
                                'Unable to retrieve datacenters list'
                            )));
                            return;
                        }

                        var result = job.__read();

                        result.forEach(function (datacenter) {
                            var old = null;

                            if (datacenters.index[datacenter.name]) {
                                old = datacenters.list.indexOf(datacenters.index[datacenter.name]);
                            }

                            datacenters.index[datacenter.name] = datacenter;

                            if (datacenters.search[datacenter.name]) {
                                datacenters.search[datacenter.name].forEach(function (r) {
                                    r.resolve(datacenter);
                                });
                                delete datacenters.search[datacenter.name];
                            }

                            if (old !== null) {
                                datacenters.list[old] = datacenter;
                            } else {
                                datacenters.list.push(datacenter);
                            }
                        });

                        datacenters.list.final = true;
                    }
                });
            }

            return datacenters.job;
        };

        service.datacenter = function (id) {
            if (id === true || (!id && !datacenters.job)) {
                var job = service.updateDatasets();
                return job.deferred;
            }

            var ret = $q.defer();
            if (!id) {
                if (datacenters.list.final) {
                    ret.resolve(datacenters.list);
                } else {
                    datacenters.job.deferred.then(function () {
                        ret.resolve(datacenters.list);
                    });
                }
            } else {
                if (!datacenters.index[id]) {
                    service.updateDatacenters();

                    if(!datacenters.search[id]) {
                        datacenters.search[id] = [];
                    }
                    datacenters.search[id].push(ret);
                } else {
                    ret.resolve(datacenters.index[id]);
                }
            }

            return ret.promise;
        };

        service.datacenters = function () {
            return datacenters.list.length > 0 ? datacenters.list : null;
        };

        if(!datacenters.job) {
            // run updatePackages
            service.updateDatacenters();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));