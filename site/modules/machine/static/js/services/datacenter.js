'use strict';

(function (app) {
    app.factory('Datacenter', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        function (serverTab, $q, localization, notification) {

        var service = {};
        var datacenters = { job: null, index: {}, list: [], search: {} };

        service.updateDatacenters = function () {
            if (!datacenters.job || datacenters.job.finished) {
                datacenters.job = serverTab.call({
                    name:'DatacenterList',
                    done: function(err, job) {
                        if (err) {
                            notification.push(datacenters.job, { type: 'error' },
                                localization.translate(null,
                                    'machine',
                                    'Unable to retrieve datacenters list'
                                )
                            );

                            return;
                        }

                        if (Object.keys(datacenters.search).length > 0) {
                            var result = job.__read();

                            Object.keys(result).forEach(function (k) {
                                if (datacenters.search[k]) {
                                    datacenters.search[k].resolve(result[k]);
                                    delete datacenters.search[k];
                                }
                            });
                        }
                    }
                });

                datacenters.index = datacenters.job.deferred;
            }

            return datacenters.job;
        };

        service.datacenter = function (id) {
            if (id === true || (!id && !datacenters.job)) {
                var job = service.updateDatacenters();
                return job.deferred;
            }

            if (!id){
                return datacenters.index;
            }


            var ret = $q.defer();
            if (!datacenters.index[id]){
                service.updateDatacenters();

                if(!datacenters.search[id]){
                    datacenters.search[id] = ret;
                }
            } else {
                setTimeout(function () {
                    ret.resolve(datacenters.index[id]);
                },1);
            }

            return ret.promise;
        };

        if(!datacenters.job) {
            // run updatePackages
            service.updateDatacenters();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));