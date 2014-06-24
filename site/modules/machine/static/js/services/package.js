'use strict';
(function (app) {
    app.factory('Package', [
        'serverTab',
        '$q',
        'localization',
        'PopupDialog',

        function (serverTab, $q, localization, PopupDialog) {

        var service = {};
        var packages = { job: {}, index: {}, nameIndex: {}, list: {}, error: {}, search: {}};

        service.updatePackages = function (datacenter) {
            datacenter = datacenter || 'all';
            if (!packages.index[datacenter]) {
                packages.index[datacenter] = {};
                packages.nameIndex[datacenter] = {};
                packages.list[datacenter] = [];
                packages.search[datacenter] = {};
            }

            var deferred = $q.defer();
            if (!packages.job[datacenter] || !packages.job[datacenter].pending) {
                packages.job[datacenter] = {};
                packages.job[datacenter].deferred = deferred;
                packages.job[datacenter].pending = true;
            } else {
                packages.job[datacenter].deferred.promise.then(deferred.resolve, deferred.reject);
                return deferred.promise;
            }

            if (packages.job[datacenter].final && !packages.job[datacenter].error) {
                deferred.resolve(packages.list[datacenter]);
                return deferred.promise;
            }


            packages.list[datacenter].final = false;
            serverTab.call({
                name:'PackageList',
                data: { datacenter: datacenter === 'all' ? null : datacenter },
                error: function (err) {
                    packages.job[datacenter].pending = false;
                    deferred.reject(err);
                },
                done: function (err, job) {
                    if (err) {
                        PopupDialog.error(
                            localization.translate(
                                null,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                null,
                                'machine',
                                'Unable to retrieve packages from datacenter {{name}}.',
                                { name: datacenter }
                            )
                        );

                        Object.keys(packages.search[datacenter]).forEach(function (job) {
                            job.reject(err);
                        });
                        packages.job[datacenter].pending = false;
                        deferred.reject(err);
                        packages.list[datacenter].final = true;
                        return;
                    }

                    var result = job.__read();
                    result.forEach(function (p) {
                        var old = null;

                        if (packages.index[datacenter][p.id]) {
                            old = packages.list.indexOf(packages.index[datacenter][p.id]);
                        }

                        packages.index[datacenter][p.id] = p;

                        if (packages.search[datacenter][p.id]) {
                            packages.search[datacenter][p.id].forEach(function (r) {
                                r.resolve(p);
                            });
                            delete packages.search[datacenter][p.id];
                        }

                        packages.nameIndex[datacenter][p.name] = p;
                        if (packages.search[datacenter][p.name]) {
                            packages.search[datacenter][p.name].forEach(function (r) {
                                r.resolve(p);
                            });
                            delete packages.search[datacenter][p.name];
                        }

                        if (old !== null) {
                            packages.list[datacenter][old] = p;
                        } else {
                            packages.list[datacenter].push(p);
                        }
                    });

                    packages.list[datacenter].final = packages.list.final = true;
                    deferred.resolve(packages.list[datacenter]);
                }
            });

            return deferred.promise;
        };

        service.package = function (params) {
            if (typeof (params) === 'string') {
                params = { id: params };
            }

            params = params || {};
            if (!params.datacenter) {
                params.datacenter = 'all';
            }

            if (params.id === true || (!params.id && !packages.job[params.datacenter])) {
                return service.updatePackages(params.datacenter);
            }

            var ret = $q.defer();
            if (!params.id) {
                if (packages.list[params.datacenter].final) {
                    if (packages.error[params.datacenter]) {
                        ret.reject(packages.error[params.datacenter]);
                    } else {
                        ret.resolve(packages.list[params.datacenter]);
                    }
                } else {
                    packages.job[params.datacenter].deferred.promise.then(function (value) {
                        ret.resolve(value);
                    }, function (value) {
                        ret.reject(value);
                    });
                }
            } else {
                if (!packages.index[params.datacenter][params.id] &&
                    !packages.nameIndex[params.datacenter][params.id]) {

                    service.updatePackages(params.datacenter);
                    if (!packages.search[params.datacenter][params.id]) {
                        packages.search[params.datacenter][params.id] = [];
                    }
                    packages.search[params.datacenter][params.id].push(ret);
                } else {
                    ret.resolve(packages.index[params.datacenter][params.id] ||
                        packages.nameIndex[params.datacenter][params.id]);
                }

            }

            return ret.promise;
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

            job.done(function (err, job) {
                deferred.resolve(findPackage(packageName));
            });

            return deferred.promise;
        };
        service.updatePackages();
        return service;
    }]);
}(window.JP.getModule('Machine')));