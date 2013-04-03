'use strict';

(function (app) {
    app.factory('Package', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        function (serverTab, $q, localization, notification) {

        var service = {};
        var packages = {job: null, index: {}, list: [], search: {}};

        service.updatePackages = function () {
            if (!packages.job || packages.job.finished) {
                packages.list.final = false;
                packages.job = serverTab.call({
                    name:'PackageList',
                    done: function(err, job) {
                        if (err) {
                            notification.push(packages.job, { type: 'error' },
                                localization.translate(null,
                                    'machine',
                                    'Unable to retrieve packages list'
                                )
                            );

                            return;
                        }

                        var result = job.__read();
                        result.forEach(function (p) {
                            var old = null;

                            if (packages.index[p.name]) {
                                old = packages.list.indexOf(packages.index[p.name]);
                            }

                            packages.index[p.name] = p;

                            if (packages.search[p.name]) {
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

            if (!id) {
                return packages.list;
            }

            if (!packages.index[id]) {
                service.updatePackages();

                if (!packages.search[id]) {
                    packages.search[id] = $q.defer();
                }

                return packages.search[id].promise;
            }
            return packages.index[id];
        };

        function findPackage(packageName) {
            var found = packages.list.filter(function (pack) {
                if (pack.name === packageName) {
                    return pack;
                }
            });

            if (found.length === 1) {
                return found[0];
            }

            return null;
        }

        service.getPackage= function (packageName) {
            var deferred = $q.defer();

            if (packages.list.final) {
                deferred.resolve(findPackage(packageName));
                return deferred.promise;
            }

            // get the new machine list.
            var job = service.updatePackages();

            var deferred = $q.defer();
            job.done(function (err, job) {
                deferred.resolve(findPackage(packageName));
            });

            return deferred.promise;
        };

        // run updatePackages
        service.updatePackages();

        return service;
    }]);
}(window.JP.getModule('Machine')));