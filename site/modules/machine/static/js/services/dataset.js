'use strict';
window.fn = [];

(function (app) {
    app.factory('Dataset', [
        'serverTab',
        '$q',
        'localization',
        'PopupDialog',
        'errorContext',
        '$rootScope',
        'util',
        function (serverTab, $q, localization, PopupDialog, errorContext, $rootScope, util) {

        var service = {};
        var datasets = { job: {}, index: {}, list: {}, search: {}, os_index: {}};

        service.updateDatasets = function (datacenter, force) {
            datacenter = datacenter || 'all';
            if (force && datacenter === 'all') {
                datasets = { job: {}, index: {}, list: {}, search: {}, os_index: {}};
            }
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
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Unable to retrieve datasets from datacenter {{name}}.',
                                    { name: datacenter }
                                ),
                                function () {}
                            );
                            //datasets.job[datacenter].deferred.reject(err);
                            Object.keys(datasets.search[datacenter]).forEach(function (job) {
                                job.reject(err);
                            });
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
                                datasets.search[datacenter][p.id].forEach(function (r) {
                                    r.resolve(p);
                                });
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
                        datasets.search[params.datacenter][params.id] = [];
                    }
                    datasets.search[params.datacenter][params.id].push(ret);
                } else {
                    ret.resolve(datasets.index[params.datacenter][params.id]);
                }

            }

            return ret.promise;
        };

        service.datasetBySimpleImage = function (params) {
            var deferred = $q.defer();

            service.updateDatasets(params.datacenter);
            datasets.job[params.datacenter].deferred.then(function (data) {
                var listDatasets = {};
                var listVersions = [];

                data.forEach(function (dataset) {
                    if (!listDatasets[dataset.name]) {
                        listDatasets[dataset.name] = {};
                    }

                    listDatasets[dataset.name][dataset.version] = dataset.id;
                    listVersions[dataset.name] = Object.keys(listDatasets[dataset.name]);

                    if (listVersions[dataset.name].length > 1) {
                        listVersions[dataset.name].sort(function (a, b) {
                            return util.cmpVersion(a, b);
                        });
                    }
                });

                var resolve;
                var datasetsByName = listDatasets[params.name];
                if (datasetsByName) {
                    var versions = {};
                    var lastMajor = null;
                    var selectedMajor = null;
                    listVersions[params.name].forEach(function (version) {
                        var re = /\w+/g;
                        var versionType = version.match(re);
                        if (versionType.length > 1) {
                            var newMajor = versionType[0];
                            if (!versions[newMajor]) {
                                versions[newMajor] = [];
                            }
                            versions[newMajor].push(version);

                            if (selectedMajor < lastMajor) {
                                selectedMajor = newMajor;
                            }
                            lastMajor = newMajor;
                        }
                    });

                    if (params.forceMajorVersion && versions[params.forceMajorVersion]) {
                        resolve = datasetsByName[versions[params.forceMajorVersion].slice(-1)];
                    }

                    if (selectedMajor && !params.forceMajorVersion) {
                        resolve = datasetsByName[versions[selectedMajor].slice(-1)];
                    } else if (!params.forceMajorVersion) {
                        resolve = datasetsByName[listVersions[params.name].slice(-1)];
                    }
                }
                deferred.resolve(resolve);
            });

            return deferred.promise;
        };

        if (!datasets.job.all) {
            // run updatePackages
            service.updateDatasets();
        }

        return service;
    }]);
}(window.JP.getModule('Machine')));