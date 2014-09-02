'use strict';

(function (app) {
    app.factory('Datacenter', [
        'serverTab',
        '$q',
        'localization',
        'errorContext',

        function (serverTab, $q, localization, errorContext) {

            var service = {};
            var datacenters = { job: null, index: {}, list: [], search: {} };

            service.updateDatacenters = function () {
            if (!datacenters.job || datacenters.job.finished) {
                datacenters.job = serverTab.call({
                    name: 'DatacenterList',
                    error: function (err) {
                        datacenters.error = err;
                    },
                    done: function (err, job) {
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
                        datacenters.error = null;
                        datacenters.list.final = true;
                    }
                });
            }

            return datacenters.job;
        };

        service.datacenter = function (id) {
            if (id === true || (!id && !datacenters.job)) {
                var job = service.updateDatacenters();
                return job.promise;
            }

            var ret = $q.defer();
            if (!id) {
                if (datacenters.list.final) {
                    if (datacenters.error) {
                        ret.reject(datacenters.error);
                    } else {
                        ret.resolve(datacenters.list);
                    }
                } else {
                    datacenters.job.promise.then(function () {
                        ret.resolve(datacenters.list);
                    }, function (err) {
                        ret.reject(err);
                        datacenters.job = null;
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

        service.datacenterPing = function (datacenter) {
            var call = serverTab.call({
                name: 'DatacenterPing',
                data: {
                    datacenter: datacenter
                },
                done: function (err, job) {
                    if (err) {
                        return err;
                    }
                    return job && job.__read();
                }
            });
            return call.promise;
        };

        if(!datacenters.job) {
            // run updatePackages
            service.updateDatacenters();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));