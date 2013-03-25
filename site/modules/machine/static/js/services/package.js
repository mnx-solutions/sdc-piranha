'use strict';

(function (app) {
    app.factory('Package', ['serverTab', '$q', function (serverTab, $q) {

        var service = {};
        var packages = {job: null, index: {}, list: [], search: {}};

        service.updatePackages = function () {
            if (!packages.job || packages.job.finished) {
                packages.list.final = false;
                packages.job = serverTab.call({
                    name:'PackageList',
                    done: function(err, job) {
                        if (err) {
                            console.log(err);
                        }
                        var result = job.__read();
                        result.forEach(function (p) {
                            var old = null;
                            if(packages.index[p.name]){
                                old = packages.list.indexOf(packages.index[p.name]);
                            }
                            packages.index[p.name] = p;
                            if (packages.search[p.name]){
                                packages.search[p.name].resolve(p);
                                delete packages.search[p.name];
                            }
                            if (old !== null) {
                                packages.list[old] = p;
                            } else {
                                packages.list.push(p);
                            }
                        });
                        packages.list.final = true;
                    }
                });
            }
            return packages.job;
        };

        service.package = function (id) {
            if (id === true || (!id && !packages.job)) {
                var job = service.updatePackages();
                return job.deferred;
            }
            if (!id){
                return packages.list;
            }
            if (!packages.index[id]){
                service.updatePackages();
                if(!packages.search[id]){
                    packages.search[id] = $q.defer();
                }
                return packages.search[id].promise;
            }
            return packages.index[id];
        };


        // run updatePackages
        service.updatePackages();

        return service;
    }]);
}(window.JP.getModule('Machine')));