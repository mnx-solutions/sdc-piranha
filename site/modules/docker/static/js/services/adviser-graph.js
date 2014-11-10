'use strict';

(function (ng, app) {
    app.factory('adviserGraph', ['$rootScope', 'util', function ($rootScope, util) {
        var defaultMetrics = ['cpuTotal', 'memory', 'network'];
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
                metrics = typeof (metrics) === 'string' ? [metrics] : metrics;
                if (Array.isArray(metrics)) {
                    var init = {};
                    metrics.forEach(function (metric) {
                        init[metric] = ng.extend({metric: metric}, defaultSettings, metricsSettings[metric] || {});
                    });
                    return init;
                }
            },
            updateValues: function (metrics, containerStats) {
                function getInterval(current, previous) {
                    // ms -> ns.
                    return (new Date(current).getTime() - new Date(previous).getTime()) * 1000000;
                }

                function hasResource(containerStats, resource) {
                    return containerStats.stats.length > 0 && containerStats.stats[0][resource];
                }

                function getResource(metric) {
                    if (metric.indexOf('cpu') !== -1) {
                        return 'cpu';
                    }
                    if (metric.indexOf('memory') !== -1) {
                        return 'memory';
                    }
                    return 'network';
                }

                var pushData = function (containerStats, metric, resource) {
                    if (containerStats.spec['has_' + resource] && !hasResource(containerStats, resource)) {
                        return;
                    }
                    var data = [];
                    var usage = [];
                    var usageSecond = [];
                    var y;
                    var y2;
                    for (var i = 1; i < containerStats.stats.length; i++) {
                        var cur = containerStats.stats[i];
                        var prev = containerStats.stats[i - 1];
                        var intervalInNs = getInterval(cur.timestamp, prev.timestamp);
                        var intervalInSec = intervalInNs / 1000000000;

                        switch (metric) {
                            case 'cpuBreakdown':
                                y = (cur.cpu.usage.user - prev.cpu.usage.user) / intervalInNs;
                                y2 = (cur.cpu.usage.system - prev.cpu.usage.system) / intervalInNs;
                                break;
                            case 'memory':
                                var currentMemoryUsage = util.getReadableFileSize(cur.memory.usage);
                                var currentMemoryWorkingSet = util.getReadableFileSize(cur.memory.working_set);
                                var memoryAbbreviation = currentMemoryWorkingSet.measure;
                                y = currentMemoryUsage.value;
                                y2 = currentMemoryWorkingSet.value;
                                if (cur.memory.usage < cur.memory.working_set) {
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
                                y = (cur.cpu.usage.total - prev.cpu.usage.total) / intervalInNs;
                                break;
                        }

                        usage.push({x: i, y: y});

                        if (typeof (y2) !== "undefined") {
                            usageSecond.push({x: i, y: y2});
                        }
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
                            for (var i = 0; i < 60; i++) {
                                chartsArray[index].push({x: i, y: 0});
                            }
                        });
                        metrics.data = chartsArray;
                    } else {
                        stats.forEach(function (stat, index) {
                            var arrayWithCurrentData = metrics.data[index];
                            if (arrayWithCurrentData) {
                                var newStatsData = stat[stat.length - 1];
                                var lastXAxisPosition = arrayWithCurrentData[arrayWithCurrentData.length - 1].x;
                                arrayWithCurrentData.shift();
                                newStatsData.x = lastXAxisPosition + 1;
                                arrayWithCurrentData.push(newStatsData);
                            }
                        });
                    }
                };

                if (typeof (metrics) === 'object' && Object.keys(metrics).length !== 0) {
                    Object.keys(metrics).forEach(function (metric) {
                        updateStats(metrics[metric], pushData(containerStats, metric, getResource(metric)));
                    });
                }
                return metrics;
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));