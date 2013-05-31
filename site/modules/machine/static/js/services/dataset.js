'use strict';

(function (app) {
    app.factory('Dataset', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',
        function (serverTab, $q, localization, notification, errorContext) {

        var service = {};
        var datasets = { job: {}, index: {}, list: {}, search: {}, os_index: {}};

        service.updateDatasets = function (datacenter) {
            datacenter = datacenter || 'all';
            if (!datasets.index[datacenter]) {
                datasets.index[datacenter] = {};
                datasets.list[datacenter] = [];
                datasets.search[datacenter] = {};
            }

            if (!datasets.job[datacenter]) {
                datasets.job[datacenter] = serverTab.call({
                    data: { datacenter: datacenter === 'all' ? null : datacenter },
                    name:'DatasetList',
                    done: function(err, job) {
                        datasets.job.finished = true;

                        if (err) {
                            errorContext.emit(new Error(localization.translate(null,
                                'machine',
                                'Unable to retrieve datasets list'
                            )));
                            return;
                        }

                        var result = job.__read();
                        result.forEach(function (p) {
                            var old = null;
                            if (datasets.index[datacenter][p.id]) {
                                old = datasets.list[datacenter].indexOf(datasets.index[datacenter][p.id]);
                            }

                            datasets.index[datacenter][p.id] = p;

                            if (datasets.search[datacenter][p.id]) {
                                datasets.search[datacenter][p.id].resolve(p);
                                delete datasets.search[datacenter][p.id];
                            }

                            if (old !== null) {
                                datasets.list[datacenter][old] = p;
                            } else {
                                datasets.list[datacenter].push(p);
                            }
                        });

                        datasets.list[datacenter].final = true;
                    }
                });
            }

            return datasets.job[datacenter];
        };

        service.dataset = function (params) {
            if (typeof params === 'string') {
                params = { id: params };
            }

            params = params || {};
            if (!params.datacenter) {
                params.datacenter = 'all';
            }

            if (params.id === true || (!params.id && !datasets.job[params.datacenter])) {
                var job = service.updateDatasets(params.datacenter);
                return job.deferred;
            }

            var ret = $q.defer();
            if (!params.id) {
                if (datasets.list[params.datacenter].final) {
                    ret.resolve(datasets.list[params.datacenter]);
                } else {
                    datasets.job[params.datacenter].deferred.then(function (value) {
                        ret.resolve(value);
                    });
                }
            } else {
                if (!datasets.index[params.datacenter][params.id]) {
                    service.updateDatasets(params.datacenter);

                    if (!datasets.search[params.datacenter][params.id]) {
                        datasets.search[params.datacenter][params.id] = ret;
                    }
                } else {
                    ret.resolve(datasets.index[params.datacenter][params.id]);
                }

            }

            return ret.promise;
        };

        if (!datasets.job.all) {
            // run updatePackages
            service.updateDatasets();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));