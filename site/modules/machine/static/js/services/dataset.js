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
                            if (datasets.index[p.id]) {
                                old = datasets.list.indexOf(datasets.index[p.id]);
                            }

                            datasets.index[p.id] = p;

                            if (datasets.search[p.id]) {
                                datasets.search[p.id].resolve(p);
                                delete datasets.search[p.id];
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

            var ret = $q.defer();
            if(!id) {
                setTimeout(function(){
                    if(datasets.list.final) {
                        ret.resolve(datasets.list);
                    } else {
                        datasets.job.deferred.then(function(value){
                            ret.resolve(value);
                        });
                    }
                },1);
            } else {
                if (!datasets.index[id]) {
                    service.updateDatasets();

                    if(!datasets.search[id]) {
                        datasets.search[id] = ret;
                    }
                } else {
                    ret.resolve(datasets.index[id]);
                }

            }

            return ret.promise;
        };

        if(!datasets.job) {
            // run updatePackages
            service.updateDatasets();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));