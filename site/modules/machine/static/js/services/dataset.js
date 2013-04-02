'use strict';

(function (app) {
    app.factory('Dataset', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        function (serverTab, $q, localization, notification) {

        var service = {};
        var datasets = {job: null, index: {}, list: [], search: {}};

        service.updateDatasets = function () {
            if (!datasets.job || datasets.job.finished) {
                datasets.list.final = false;
                datasets.job = serverTab.call({
                    name:'DatasetList',
                    done: function(err, job) {
                        if (err) {
                            notification.push(datasets.job, { type: 'error' },
                                localization.translate(null,
                                    'machine',
                                    'Unable to retrieve datasets list'
                                )
                            );

                            return;
                        }

                        var result = job.__read();
                        result.forEach(function (p) {
                            var old = null;
                            if (datasets.index[p.urn]) {
                                old = datasets.list.indexOf(datasets.index[p.urn]);
                            }

                            datasets.index[p.urn] = p;

                            if (datasets.search[p.urn]) {
                                datasets.search[p.urn].resolve(p);
                                delete datasets.search[p.urn];
                            }

                            if (old !== null) {
                                datasets.list[old] = p;
                            } else {
                                datasets.list.push(p);
                            }
                        });

                        datasets.list.final = true;
                    }
                });
            }
            return datasets.job;
        };

        service.dataset = function (id) {
            if (id === true || (!id && !datasets.job)) {
                var job = service.updateDatasets();
                return job.deferred;
            }

            if (!id) {
                return datasets.list;
            }

            if (!datasets.index[id]) {
                service.updateDatasets();

                if(!datasets.search[id]) {
                    datasets.search[id] = $q.defer();
                }

                return datasets.search[id].promise;
            }

            return datasets.index[id];
        };

        // run updatePackages
        service.updateDatasets();

        return service;
    }]);
}(window.JP.getModule('Machine')));