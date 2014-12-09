'use strict';
(function (app, ng) {
    app.controller('cloudController', [
        '$scope', 'PopupDialog', '$routeParams', 'Machine', '$timeout', '$location', '$q', 'localization',
        'CloudAnalytics',
        function ($scope, PopupDialog, $routeParams, Machine, $timeout, $location, $q, localization, CloudAnalytics) {
            $scope.machineExists = true;
            $scope.selectedInstance = $scope.machineid = $scope.machineid || $routeParams.machineid;

            $scope.machine = Machine.machine($scope.machineid);

            $scope.zones = Machine.machine();

            $scope.loaded = false;
            function createDefaultVariables(machine) {
                $scope.machine = machine;
                $scope.machineid = machine.id;
                $scope.datacenter = machine.datacenter;
                $scope.zoneName = machine.name;
                $scope.$emit('loaded');
                $scope.loaded = true;
            }

            $q.when($scope.machine).then(createDefaultVariables);

            function runWhenLoaded(callback) {
                if ($scope.loaded) {
                    callback();
                } else {
                    $scope.$on('loaded', callback);
                }
            }

            $scope.graphs = [];
            $scope.zoneName = null;
            $scope.datacenter = null;
            $scope.help = null;
            $scope.croppedModule = true;
            $scope.croppedMetric = true;

            $scope.endtime = Math.floor(new Date() / 1000);
            $scope.current = {
                metric: null,
                decomposition: {
                    primary: null,
                    secondary: null,
                    secondaryF: []
                }
            };

            CloudAnalytics.describeAnalytics().then(function () {
                var ca = CloudAnalytics.ca;
                $scope.conf = ca;
                $scope.help = ca.help;
                $scope.metrics = ca.metrics;
                $scope.fields = ca.fields;
            });

            var displayGraphsTimeout = {};

            function removeAll(options) {
                return function () {
                    CloudAnalytics.stopPolling(options);
                };
            }
            function startPolling() {
                runWhenLoaded(function () {
                    CloudAnalytics.startPolling({
                        zoneId: $scope.machineid,
                        datacenter: $scope.datacenter,
                        get start () {
                            return $scope.endtime;
                        }
                    }, function () {
                        $scope.endtime += 1;
                        if (!$scope.graphs.length) {
                            if (!displayGraphsTimeout[$scope.machineid]) {
                                // if graphs isn't displayed - instrumentations should be removed after 5 sec
                                displayGraphsTimeout[$scope.machineid] = setTimeout(removeAll({
                                        datacenter: $scope.datacenter,
                                        zoneId: $scope.machineid}
                                ), 5000);
                            }
                        } else if (displayGraphsTimeout[$scope.machineid]) {
                            clearTimeout(displayGraphsTimeout[$scope.machineid]);
                            delete displayGraphsTimeout[$scope.machineid];
                        }
                    });
                });
            }

            function createConfig() {
                var decompositions = [];

                if ($scope.current.decomposition.primary) {
                    decompositions.push($scope.current.decomposition.primary);
                }

                if ($scope.current.decomposition.secondary) {
                    decompositions.push($scope.current.decomposition.secondary);
                }

                var mod = $scope.current.metric.module;
                var predicate = (mod === 'zfs' && {}) || { "eq": ["zonename", $scope.machineid ]};

                return {
                    module: mod,
                    stat: $scope.current.metric.stat,
                    decomposition: decompositions,
                    predicate: predicate,
                    datacenter: $scope.datacenter
                };
            }

            $scope.canCreate = function () {
                if ($scope.current.metric && $scope.machineid) {
                    var key = CloudAnalytics.createCacheKey(createConfig());
                    var cache = CloudAnalytics.instrumentationCache[$scope.machineid];
                    return !(cache && cache[key]);
                }
                return false;
            };

            function createDefaultInstrumentationConfigs(plain, short) {
                var configs = [
                    [{
                        module: 'cpu',
                        stat: 'usage',
                        decomposition: [],
                        predicate: { 'eq': ['zonename', $scope.machineid] },
                        datacenter: $scope.datacenter
                    }, {
                        module: 'cpu',
                        stat: 'waittime',
                        decomposition: [],
                        predicate: { 'eq': ['zonename', $scope.machineid] },
                        datacenter: $scope.datacenter
                    }], [{
                        module: 'memory',
                        stat: 'rss',
                        decomposition: [],
                        predicate: { 'eq': ['zonename', $scope.machineid] },
                        datacenter: $scope.datacenter
                    }, {
                        module: 'memory',
                        stat: 'rss_limit',
                        decomposition: [],
                        predicate: { 'eq': ['zonename', $scope.machineid] },
                        datacenter: $scope.datacenter
                    }], [{
                        module: 'memory',
                        stat: 'reclaimed_bytes',
                        decomposition: [],
                        predicate: { 'eq': ['zonename', $scope.machineid] },
                        datacenter: $scope.datacenter
                    }], [{
                        module: 'zfs',
                        stat: 'dataset_unused_quota',
                        decomposition: [],
                        predicate: {},
                        datacenter: $scope.datacenter
                    }, {
                        module: 'zfs',
                        stat: 'dataset_quota',
                        decomposition: [],
                        predicate: {},
                        datacenter: $scope.datacenter
                    }], [{
                        module: 'nic',
                        stat: 'vnic_bytes',
                        decomposition: ['zonename'],
                        predicate: { "eq": ["zonename", $scope.machineid] },
                        datacenter: $scope.datacenter
                    }]
                ];
                if (short) {
                    configs = [configs[0], configs[1], configs[4]];
                }
                return plain ? [].concat.apply([], configs) : configs;
            }

            function buildGraphData(instrumentations, configs, append) {
                configs = configs || createDefaultInstrumentationConfigs(false);
                $scope.graphs = append ? $scope.graphs : [];
                var k;
                var z;
                var instrumentationsCopy = {};

                for (k in instrumentations) {
                    if (instrumentations.hasOwnProperty(k)) {
                        instrumentationsCopy[k] = instrumentations[k];
                    }
                }

                for (k = 0; k < configs.length; k += 1) {
                    var graphs = [];
                    for (z = 0; z < configs[k].length; z += 1) {
                        var key = CloudAnalytics.createCacheKey(configs[k][z]);
                        if (instrumentations[key]) {
                            graphs.push(instrumentations[key]);
                            delete instrumentationsCopy[key];
                        }
                    }
                    if (graphs.length) {
                        $scope.graphs.push({instrumentations: graphs});
                    }
                }

                for (k in instrumentationsCopy) {
                    if (instrumentationsCopy.hasOwnProperty(k)) {
                        $scope.graphs.push({instrumentations: [instrumentationsCopy[k]]});
                    }
                }

                startPolling();
            }

            function createNamedGraphs() {
                function getGraph(stat) {
                    return $scope.graphs.filter(function (e) {
                        return e.instrumentations.filter(function (i) {
                            return i.config.stat === stat;
                        }).length;
                    }).slice(0, 1);
                }

                $scope.cpuGraphs = getGraph('usage');
                $scope.memGraphs = getGraph('rss');
                $scope.nicGraphs = getGraph('vnic_bytes');
            }

            function createDefaultInstrumentations(short, callback) {
                callback = callback || angular.noop;
                runWhenLoaded(function () {
                    CloudAnalytics.describeInstrumentations({datacenter: $scope.datacenter, zoneId: $scope.machineid},
                        function (data) {
                            if (data && data.error) {
                                PopupDialog.errorObj(data.error);
                            }
                            CloudAnalytics.createInstrumentations({
                                zoneId: $scope.machineid,
                                datacenter: $scope.datacenter,
                                range: $scope.instrumentationRange,
                                configs: createDefaultInstrumentationConfigs(true, short)
                            }, function (error, newInstrumentations, instrumentations) {
                                buildGraphData(instrumentations, createDefaultInstrumentationConfigs(false, short));
                                callback();
                            });
                        });
                });
            }

            $scope.createDefaultInstrumentations = function () {
                createDefaultInstrumentations(false);
            };

            $scope.createMachineDetailInstrumentations = function () {
                createDefaultInstrumentations(true, createNamedGraphs);
            };

            $scope.createInstrumentation = function () {
                runWhenLoaded(function () {
                    var config = createConfig();
                    CloudAnalytics.createInstrumentations({
                        datacenter: $scope.datacenter,
                        zoneId: $scope.machineid,
                        range: $scope.instrumentationRange,
                        configs: [config]
                    }, function (error, instrumentations) {
                        buildGraphData(instrumentations, [config], true);
                    });
                });
            };

            $scope.deleteAllInstrumentations = function (callback) {
                callback = callback || angular.noop;
                runWhenLoaded(function () {
                    CloudAnalytics.removeAll({datacenter: $scope.datacenter, zoneId: $scope.machineid},
                        function () {
                            $scope.graphs = [];
                            callback();
                        });
                });
            };

            $scope.changeInstance = function () {
                CloudAnalytics.stopPolling({datacenter: $scope.datacenter, zoneId: $scope.machineid}, function () {
                    $q.when(Machine.machine($scope.selectedInstance)).then(createDefaultVariables);
                    $location.path('/cloudAnalytics/' + $scope.selectedInstance);
                });
            };

            $scope.resetMetric = function() {
                $scope.croppedMetric = true;
                $scope.croppedModule = true;
                $scope.current.decomposition.primary = null;
                $scope.current.decomposition.secondary = null;
                $scope.current.decomposition.secondaryF = null;
                $('#decPrimarySelect').select2('val', '-- None --');
                $('#decSecondarySelect').select2('val', '-- None --');
            };

            $scope.expandMetric = function () {
                $scope.croppedMetric = !$scope.croppedMetric;
            };

            $scope.expandModule = function () {
                $scope.croppedModule = !$scope.croppedModule;
            };

            $scope.changeDecomposition = function () {
                $scope.croppedMetric = true;
                $scope.croppedModule = true;

                if ($scope.current.decomposition.primary) {
                    var currentType = $scope.conf.fields[$scope.current.decomposition.primary].type;
                    var currentArity = $scope.conf.types[currentType].arity;
                    var field;
                    $scope.current.decomposition.secondaryF = [];
                    $scope.current.decomposition.secondary = null;

                    for (field in $scope.current.metric.fields) {
                        var fieldType = $scope.conf.fields[field].type;
                        var fieldArity = $scope.conf.types[fieldType].arity;
                        if (fieldArity !== currentArity) {
                            $scope.current.decomposition.secondaryF[field] = $scope.current.metric.fields[field];
                        }
                    }
                } else {
                    $scope.current.decomposition.secondaryF = [];
                    $scope.current.decomposition.secondary = null;
                }
            };

            $scope.zoom = function (inc) {
                CloudAnalytics.instrumentationCache.forEach($scope.machineid, function (instrumentation) {
                    var index = CloudAnalytics.ranges.indexOf(instrumentation.range);
                    var range = CloudAnalytics.ranges[index + inc];
                    if (range) {
                        $scope.instrumentationRange = instrumentation.range = range;
                    }

                    $scope.zoomOutDisable = (index + inc === 0);
                    $scope.zoomInDisable = (index + inc === CloudAnalytics.ranges.length - 1);
                });
            };

            $scope.$on('$destroy', function () {
                CloudAnalytics.stopPolling({datacenter: $scope.datacenter, zoneId: $scope.machineid});
            });
        }]);
}(window.JP.getModule('cloudAnalytics'), window.angular));