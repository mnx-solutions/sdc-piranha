'use strict';

(function (app) {
    app.factory('Datacenter', ['serverTab', '$q', function (serverTab, $q) {

        var service = {};
        var datacenters = {job: null, index: {}, list: [], search: {}};

        service.updateDatacenters = function () {
            if (!datacenters.job || datacenters.job.finished) {
                datacenters.job = serverTab.call({
                    name:'DatacenterList',
                    done: function(err, job) {
                        if (err) {
                            console.log(err);
                        }
                        if(Object.keys(datacenters.search).length > 0) {
                            var result = job.__read();
                            Object.keys(result).forEach(function (k) {
                                if(datacenters.search[k]) {
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
            if (!datacenters.index[id]){
                service.updateDatacenters();
                if(!datacenters.search[id]){
                    datacenters.search[id] = $q.defer();
                }
                return datacenters.search[id].promise;
            }
            return datacenters.index[id];
        };


        // run updatePackages
        service.updateDatacenters();

        return service;
    }]);
}(window.JP.getModule('Machine')));