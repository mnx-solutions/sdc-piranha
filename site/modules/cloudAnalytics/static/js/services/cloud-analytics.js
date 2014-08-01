'use strict';


(function (app) {
    function InstrumentationCache() {}
    InstrumentationCache.prototype = {
        findById: function (zoneId, id) {
            var result = [];
            this.forEach(zoneId, function (instrumentation) {
                if (+instrumentation.id === +id) {
                    result.push(instrumentation);
                }
            });
            return result;
        },
        keyById: function (zoneId, id) {
            var instrumentation = this.findById(zoneId, id)[0];
            return instrumentation && instrumentation.key;
        },
        length: function (zoneId) {
            //noinspection JSLint
            return zoneId ? Object.keys(Object(this[zoneId])).length : Object.keys(this).length;
        },
        forEach: function (zoneId, callback) {
            var k;
            //noinspection JSLint
            var keys = Object.keys(Object(this[zoneId]));
            for (k = 0; k < keys.length; k += 1) {
                callback(this[zoneId][keys[k]], k);
            }
        }
    };
    var instrumentationCache = new InstrumentationCache();

    app.factory('CloudAnalytics', [
        'ca.dataset', 'http', '$q', 'localization', 'PopupDialog',
        function (DataSet, http, $q, localization, PopupDialog) {
            http.config({
                url: 'cloudAnalytics/ca/:datacenter/:zoneId/:action'
            });

            var service = http.createService({
                describeInstrumentations: {
                    method: 'GET',
                    params: {
                        datacenter: '=',
                        zoneId: '=',
                        action: 'describeInstrumentations'
                    }
                },
                describeAnalytics: {
                    method: 'GET',
                    params: {}
                },
                createInstrumentations: {
                    method: 'POST',
                    params: {
                        datacenter: '=',
                        zoneId: '=',
                        action: 'instrumentations'
                    }
                },
                getValues: {
                    method: 'GET',
                    params: {
                        datacenter: '=',
                        zoneId: '=',
                        action: 'instrumentations',
                        start: '='
                    }
                },
                getHeatmap: {
                    method: 'POST',
                    params: {
                        datacenter: '=',
                        zoneId: '=',
                        action: 'getHeatmap'
                    }
                },
                deleteInstrumentation: {
                    method: 'DELETE',
                    params: {
                        datacenter: '=',
                        zoneId: '=',
                        action: '@id'
                    }
                },
                deleteAllInstrumentations: {
                    method: 'DELETE',
                    params: {
                        datacenter: '=',
                        zoneId: '='
                    }
                }
            });

            var ca = null;
            var palette = new Rickshaw.Color.Palette({ scheme: 'colorwheel' });
            var usedColors = {
                default: 'steelblue'
            };

            function getColor(key) {
                if (usedColors[key]) {
                    return usedColors[key];
                }
                usedColors[key] = palette.color();
                return usedColors[key];
            }

            function createCacheKey(instrumentationConfig) {
                return [
                    instrumentationConfig.module,
                    instrumentationConfig.stat,
                    instrumentationConfig.decomposition.join(':')
                ].join(':');
            }

            function Instrumentation(options) {
                this.config = options.config;
                this.options = options;
                this.id = +options.config.id;
                this.datacenter = options.datacenter;
                this.machineId = options.zoneId;
                this.timer = null;
                this.data = new DataSet({startTime: options.config.crtime});
                this.range = options.range || 60;
                this._title = null;
                this.type = null;
                this.init();
            }

            Instrumentation.prototype.init = function () {
                this.config.decomposition = this.config.decomposition || [];
                this.key = createCacheKey(this.config);

                var metrics = ca.ca.metrics;
                var fields = ca.ca.fields;
                var types = ca.ca.types;
                var decompositions = this.config.decomposition || [];
                var title = '';
                var type = null;
                for (var m in metrics) {
                    var metric = metrics[m];
                    if (metric.module === this.config.module && metric.stat === this.config.stat) {
                        title = metric.labelHtml;
                        type = metric.type && types[metric.type] || null;
                        break;
                    }
                }

                if (decompositions.length) {
                    title += ' decomposed by';
                    var k;
                    for (k = 0; k < decompositions.length; k += 1) {
                        title += ' ' + fields[decompositions[k]].label;
                    }
                }
                
                this.type = type;
                this.title = title;
            };

            Instrumentation.prototype.destroy = function (woApi, callback) {
                delete instrumentationCache[this.machineId][this.key];
                if (typeof woApi === 'function') {
                    callback = woApi;
                    woApi = false;
                }
                callback = callback || angular.noop;
                if (this.timer) {
                    clearInterval(this.timer.$$timeoutId);
                }
                if (!woApi) {
                    service.deleteInstrumentation({
                        datacenter: this.datacenter,
                        zoneId: this.machineId,
                        id: this.id
                    }, callback);
                }
                this.timer = null;
            };

            Instrumentation.prototype.getHeatmap = function (options, callback) {
                var values = this.data.getValue(options.endtime);
                var config = angular.extend({}, this.config, {
                    datacenter: this.datacenter,
                    id: this.id,
                    duration: options.range,
                    endtime: options.endtime,
                    x: options.location.x,
                    y: options.location.y
                });

                if (values && typeof(values.ymin) !== 'undefined' && typeof(values.ymax) !== 'undefined') {
                    config.ymin = values.ymin;
                    config.ymax = values.ymax;
                }

                service.getHeatmap({datacenter: this.datacenter, zoneId: this.machineId}, config, callback);
            };

            Instrumentation.prototype.getSeries = function (instrumentations, time, iService) {
                var seriesCollection = [];
                var i;
                for (i = 0; i < instrumentations.length; i += 1) {
                    var instrumentation = instrumentations[i];

                    var heatmap = instrumentation.config['value-arity'] === 'numeric-decomposition';

                    var series = instrumentation.data.getValues(this.id, {
                        nr: this.range || iService.range,
                        endTime: time
                    });

                    var times = series._timestamps;
                    series._timestamps = undefined;

                    for (var name in series) {
                        var data = [];
                        var hms;

                        for (var dp in series[name]) {
                            var y = series[name][dp];

                            if (heatmap) {
                                y = series[name][dp].ymax || 0;
                            }

                            if (series[name][dp] !== 0) {
                                hms = series[name][dp].hm;
                            }

                            data.push({
                                x: times[dp] || 0,
                                y: y
                            });
                        }

                        instrumentation.heatmap = hms;

                        var gName = name;
                        if (name === 'default' && instrumentation.config.stat) {
                            gName = ca.ca.metrics.filter(function (metric) {
                                return metric.stat === instrumentation.config.stat;
                            })[0].label;
                        }

                        seriesCollection.push({
                            name: gName,
                            data: data,
                            color: getColor(gName)
                        });

                        if (!seriesCollection.length) {
                            var seriesData = [];
                            var range = this.range || iService.range;
                            var endtime = times[times.length - 1];

                            for (; range >= 0; --range ) {
                                seriesData.push({
                                    x:endtime-range,
                                    y:0
                                });
                            }

                            seriesCollection.push({
                                name: 'default',
                                data: seriesData,
                                color: getColor('default')
                            });
                        }

                    }

                }
                return seriesCollection;
            };

            Instrumentation.prototype.onupdate = function () {};

            function CloudAnalytics() {
                this.polls = {};
            }

            CloudAnalytics.prototype.ranges = [ 10, 31, 60, 90, 120, 150, 180 ];
            CloudAnalytics.prototype.ca = {};
            CloudAnalytics.prototype.describeAnalytics = function () {
                var self = this;
                var d = $q.defer();
                var metrics = self.ca.metrics;
                if (metrics && Array.isArray(metrics) && metrics.length > 0) {
                    d.resolve(self.ca);
                } else {
                    service.describeAnalytics(function (error, response) {
                        if (error) {
                            PopupDialog.error(
                                localization.translate(null, null, 'Error'),
                                localization.translate(null, null, error)
                            );
                            d.reject(error);
                        } else {
                            var result = response.res;
                            var k;
                            for (k in result) {
                                if (result.hasOwnProperty(k)) {
                                    self.ca[k] = result[k];
                                }
                            }
                            var createLabels = function (metric) {
                                var fields = {};
                                var l;
                                for (l = 0; l < metric.fields.length; l += 1) {
                                    var field = metric.fields[l];
                                    if (self.ca.fields[field]) {
                                        fields[field] = self.ca.fields[field].label;
                                    }
                                }

                                var moduleName = self.ca.modules[metric.module].label;
                                metric.fields = fields;
                                metric.labelHtml = moduleName + ': ' + metric.label;
                            };
                            self.ca.metrics.forEach(createLabels);
                            d.resolve(self.ca);
                        }
                    });
                }
                return d.promise;
            };
            
            CloudAnalytics.prototype.createInstrumentations = function (options, callback) {
                var cache = instrumentationCache[options.zoneId] = instrumentationCache[options.zoneId] || {};
                var configs = options.configs.filter(function (config) {
                    var key = createCacheKey(config);
                    return !cache[key];
                });
                if (!configs.length) {
                    return callback(null, [], cache);
                }
                service.createInstrumentations(options, configs, function (error, response) {
                    var instrumentations = [];
                    if (response && Array.isArray(response.res)) {
                        instrumentations = response.res;
                    }
                    var newInstrumentations = {};
                    instrumentations.forEach(function (instrumentation) {
                        instrumentation = new Instrumentation({
                            datacenter: options.datacenter,
                            zoneId: options.zoneId,
                            range: options.range,
                            config: instrumentation
                        });
                        cache[instrumentation.key] = instrumentation;
                        newInstrumentations[instrumentation.key] = instrumentation;
                    });
                    callback(error, newInstrumentations, cache);
                });
                return null;
            };

            CloudAnalytics.prototype.getValues = function (options, callback) {
                var self = this;
                var cache = {};
                callback = callback || angular.noop;
                instrumentationCache.forEach(options.zoneId, function (instrumentation) {
                    cache[instrumentation.id] = instrumentation;
                });
                
                service.getValues(options, function (error, response) {
                    var values = response.res || [];
                    if (!error && !values.length) {
                        // instrumentations were lost
                        self.stopPolling(options);
                        return;
                    }
                    values.forEach(function (value) {
                        if (cache[value.id]) {
                            var result = Array.isArray(value.value) ? value.value : [value.value];
                            cache[value.id].data.addValues(result);
                            cache[value.id].onupdate(result);
                        }
                    });
                    callback(error, values);
                });
            };

            CloudAnalytics.prototype.remove = function (zoneId, id, callback) {
                var key = instrumentationCache.keyById(zoneId, id);
                var instrumentation = instrumentationCache[key];
                instrumentation.destroy(function () {
                    delete instrumentation[key];
                    callback(this, arguments);
                });
            };

            CloudAnalytics.prototype.removeAll = function (options, callback) {
                callback = callback || angular.noop;
                instrumentationCache.forEach(options.zoneId, function (instrumentation) {
                    instrumentation.destroy(true);
                });
                instrumentationCache[options.zoneId] = {};
                service.deleteAllInstrumentations(options, callback);
            };

            CloudAnalytics.prototype.create = function (options, callback) {
                service.createInstrumentation(options, options.config, callback);
            };

            CloudAnalytics.prototype.describeInstrumentations = function (options, callback) {
                service.describeInstrumentations(options, function (error, response) {
                    var instrumentations = response && response.res || [];
                    var cache = instrumentationCache[options.zoneId] = {};
                    instrumentations.forEach(function (instrumentation) {
                        instrumentation = new Instrumentation({
                            datacenter: options.datacenter,
                            zoneId: options.zoneId,
                            config: instrumentation
                        });
                        cache[instrumentation.key] = instrumentation;
                    });
                    callback(error, cache);
                });
            };
            CloudAnalytics.prototype.createCacheKey = createCacheKey;
            CloudAnalytics.prototype.instrumentationCache = instrumentationCache;
            
            CloudAnalytics.prototype.startPolling = function (options, callback) {
                var self = this;
                var timer = this.polls[options.zoneId];
                if (timer) {
                    clearInterval(timer);
                }
                // check chart data every 1 sec
                this.polls[options.zoneId] = setInterval(function () {
                    if (instrumentationCache.length(options.zoneId)) {
                        self.getValues(options, callback);
                    }
                }, 1000);
            };
            
            CloudAnalytics.prototype.stopPolling = function (options, callback) {
                callback = callback || angular.noop;
                var self = this;
                var timer = this.polls[options.zoneId];
                if (timer) {
                    clearInterval(timer);
                }
                // remove all polled instrumentations 3 sec after stopping
                this.polls[options.zoneId] = setTimeout(function () {
                    self.removeAll(options);
                }, 3000);
                callback();
            };
            ca = new CloudAnalytics();
            ca.describeAnalytics();
            return ca;
        }]);
}(window.JP.getModule('cloudAnalytics'), window.angular));
