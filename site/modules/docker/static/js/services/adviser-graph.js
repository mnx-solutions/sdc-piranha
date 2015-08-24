'use strict';

(function (ng, app) {
    var metricsDataCache = {};
    app.factory('adviserGraph', ['$rootScope', 'util', function ($rootScope, util) {
        var defaultMetrics = ['cpuTotal', 'memory', 'network'];
        var prevs = {};
        var range = 60;
        var availableRanges = [10, 31, 60, 90, 120, 150, 180];
        return {
            init: function (metrics) {
                var defaultSettings = {
                    data: [],
                    options: {
                        type: {
                            arity: 'numeric',
                            unit: 'bytes',
                            abbr: 'B',
                            base: 2,
                            name: 'size'
                        },
                        title: '',
                        legends: [],
                        colors: []
                    }
                };

                var metricsSettings = {};
                metricsSettings.cpuTotal = {
                    options: {
                        type: {
                            abbr: '%',
                            power: 1
                        },
                        title: 'CPU: Total usage',
                        legends: ['aggregated CPU usage'],
                        colors: ['#78959B']
                    }
                };

                metricsSettings.cpuBreakdown = {
                    options: {
                        type: {
                            abbr: '%',
                            power: 1
                        },
                        title: 'CPU: Breakdown',
                        legends: ['user', 'kernel'],
                        colors: ['#FFC634', '#EDFF68']
                    }
                };

                metricsSettings.memory = {
                    options: {
                        title: 'Memory usage',
                        legends: ['current memory usage', 'memory working set'],
                        colors: ['#cb513a', '#73c03a']
                    }
                };

                metricsSettings.network = {
                    options: {
                        title: 'Network bytes tx/rx',
                        legends: ['Tx', 'Rx'],
                        colors: ['#65B9AC', '#73C03A']
                    }
                };

                metricsSettings.networkPackets = {
                    options: {
                        title: 'Network packets tx/rx',
                        legends: ['Tx', 'Rx'],
                        colors: ['#65B9AC', '#73C03A']
                    }
                };

                metricsSettings.networkErrors = {
                    options: {
                        title: 'Network errors tx/rx',
                        legends: ['Tx', 'Rx'],
                        colors: ['#65B9AC', '#73C03A']
                    }
                };

                metrics = metrics || defaultMetrics;
                metrics = typeof metrics === 'string' ? [metrics] : metrics;
                if (Array.isArray(metrics)) {
                    var init = {};
                    metrics.forEach(function (metric) {
                        init[metric] = ng.extend({metric: metric}, defaultSettings, metricsSettings[metric] || {});
                        metricsDataCache[metric] = [];
                    });
                    return init;
                }
            },
            zoom: function (inc) {
                var index = availableRanges.indexOf(range);
                var newRange = availableRanges[index + inc];
                if (newRange) {
                    range = newRange;
                }
                return {
                    zoomOutDisable: (index + inc === 0),
                    zoomInDisable: (index + inc === availableRanges.length - 1)
                };
            },
            updateValues: function (metrics, containerStats) {
                function getInterval(current, previous) {
                    return new Date(current).getTime() - new Date(previous).getTime();
                }

                var pushData = function (containerStats, metric) {
                    var data = [];
                    var usage = [];
                    var usageSecond = [];
                    var y;
                    var y2;
                    for (var i = 0; i < containerStats.stats.length; i++) {
                        var cur = containerStats.stats[i];
                        var prev = prevs[metric];
                        if (!prev) {
                            prevs[metric] = cur;
                            continue;
                        }
                        var intervalInMs = getInterval(cur.read, prev.read);
                        var intervalInSec = intervalInMs / 1000;
                        if (intervalInSec <= 0) {
                            continue;
                        }
                        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
                        switch (metric) {
                            case 'cpuBreakdown':
                                y = (cur.cpu_stats.cpu_usage.usage_in_usermode - prev.cpu_stats.cpu_usage.usage_in_usermode) / intervalInMs;
                                y2 = (cur.cpu_stats.system_cpu_usage - prev.cpu_stats.system_cpu_usage) / intervalInMs;
                                break;
                            case 'memory':
                                var currentMemoryUsage = util.getReadableFileSize(cur.memory_stats.usage);
                                var currentMemoryWorkingSet = util.getReadableFileSize(cur.memory_stats.limit);
                                var memoryAbbreviation = currentMemoryWorkingSet.measure;
                                y = Number(currentMemoryUsage.value);
                                y2 = Number(currentMemoryWorkingSet.value);
                                if (cur.memory_stats.usage < cur.memory_stats.limit) {
                                    memoryAbbreviation = currentMemoryUsage.measure;
                                }
                                metrics.memory.options.type = {abbr: memoryAbbreviation};
                                break;
                            case 'network':
                                y = (cur.network.tx_bytes - prev.network.tx_bytes) / intervalInSec;
                                y2 = (cur.network.rx_bytes - prev.network.rx_bytes) / intervalInSec;
                                break;
                            case 'networkPackets':
                                y = (cur.network.tx_packets - prev.network.tx_packets) / intervalInSec;
                                y2 = (cur.network.rx_packets - prev.network.rx_packets) / intervalInSec;
                                break;
                            case 'networkErrors':
                                y = (cur.network.tx_errors - prev.network.tx_errors) / intervalInSec;
                                y2 = (cur.network.rx_errors - prev.network.rx_errors) / intervalInSec;
                                break;
                            default:
                                y = ((cur.cpu_stats.cpu_usage.total_usage - prev.cpu_stats.cpu_usage.total_usage) / intervalInMs) / 1000;
                                break;
                        }
                        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers

                        usage.push({x: i, y: y});

                        if (typeof y2 !== 'undefined') {
                            usageSecond.push({x: i, y: y2});
                        }
                        prevs[metric] = cur;
                    }

                    data.push(usage);
                    if (usageSecond.length) {
                        data.push(usageSecond);
                    }
                    return data;
                };

                var updateStats = function (metrics, stats) {
                    if (!stats) {
                        return;
                    }
                    if (metrics.data.length === 0) {
                        var chartsArray = [];
                        stats.forEach(function (stat, index) {
                            chartsArray[index] = [];
                            for (var i = 0; i < range; i++) {
                                chartsArray[index].push({x: i, y: 0});
                            }
                        });
                        metrics.data = chartsArray;
                    } else {
                        var metricCache = metricsDataCache[metrics.metric];
                        stats.forEach(function (stat, index) {
                            var currentData = metrics.data[index];
                            if (currentData && currentData.length && stat.length) {
                                var dataSize = currentData.length;
                                var dataCache = metricCache[index] = metricCache[index] || [];
                                if (dataSize > range) {
                                    metricCache[index] = dataCache = dataCache
                                        .concat(currentData.splice(0, dataSize - range));
                                } else if (dataSize < range && dataCache.length) {
                                    metrics.data[index] = currentData = dataCache
                                        .splice(
                                            dataCache.length - range + dataSize,
                                            dataCache.length
                                        )
                                        .concat(currentData);
                                } else if (dataSize < range && !dataCache.length) {
                                    for (var i = 0; i < range - dataSize; i++) {
                                        currentData.unshift({x: currentData[0].x - 1, y: 0});
                                    }
                                }

                                var newStatsData = stat[stat.length - 1];
                                var lastXAxisPosition = currentData[currentData.length - 1].x;
                                if (dataCache.length) {
                                    dataCache.shift();
                                    dataCache.push(currentData.shift());
                                } else {
                                    currentData.shift();
                                }
                                newStatsData.x = lastXAxisPosition + 1;
                                currentData.push(newStatsData);
                            }
                        });
                    }
                };

                if (typeof metrics === 'object' && Object.keys(metrics).length !== 0) {
                    Object.keys(metrics).forEach(function (metric) {
                        updateStats(metrics[metric], pushData(containerStats, metric));
                    });
                }
                return metrics;
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));
