'use strict';

var config = require('easy-config');
var manta = require('manta');
var vasync = require('vasync');

module.exports = function execute(scope) {

    var server = scope.api('Server');

    if (config.features.usageData !== 'enabled') {
        return;
    }

    var client = manta.createClient({
        sign: manta.privateKeySigner({
            key: config.usageData.key,
            keyId: config.usageData.keyId,
            user: config.usageData.user
        }),
        user: config.usageData.user,
        url: config.usageData.url,
        rejectUnauthorized: false
    });

    var pad = function (num) {
        return num < 10 ? '0' + num : num;
    };

    var daysInMonth = function (year, month) {
        return new Date(year, month, 0).getDate();
    };

    var getStats = function (statObj, callback) {
        client.get(statObj.url, function (err, stream) {
            if (err && err.statusCode !== 404) {
                callback('Error reading stats');
                return;
            }
            if (stream) {
                var result = '';
                stream.setEncoding('utf8');
                stream.on('data', function (chunk) {
                    result += chunk;
                });
                stream.on('end', function () {
                    var resultObj = JSON.parse(result);
                    resultObj.date = statObj.date;
                    callback(null, resultObj);
                });
            } else {
                callback(null, {date: statObj.date});
            }
        });
    };

    var getUsageDataEntry = function (zone, configs, opts) {
        var usageData = {
            uuid: zone.uuid,
            alias: zone.alias,
            package_uuid: configs.package.uuid,
            package_name: configs.package.name,
            datacenter_name: zone.datacenter_name,
            first: configs.date,
            last: configs.date
        };
        for (var key in opts) {
            usageData[key] = opts[key];
        }
        return usageData;
    };

    server.onCall('UtilizationData', {
        verify: function (data) {
            return data
                && data.hasOwnProperty('year')
                && data.hasOwnProperty('month');
        },
        handler: function (call) {
            var statUrls = [];
            var year = parseInt(call.data.year, 10);
            var month = parseInt(call.data.month, 10);
            var daysMax = daysInMonth(call.data.year, call.data.month);
            var customerId = config.usageData && config.usageData.userId || call.req.session.userId;
            for (var day = 1; day <= daysMax; day++) {
                var paddedMonth = pad(month);
                var paddedDay = pad(day);
                var statUrl = '/jpc_manta_storage/stor/customer_usage/' + year + '/' + paddedMonth +
                    '/' + paddedDay + '/' + customerId + '.json';
                statUrls.push({url: statUrl, date: year + '-' + paddedMonth + '-' + paddedDay});
            }
            vasync.forEachParallel({
                func: getStats,
                inputs: statUrls
            }, function (err, results) {
                var overallResult = {
                    currentspend: {
                        days: daysMax,
                        year: year,
                        month: month,
                        total: 0,
                        amount: {},
                        usage: []
                    },
                    dram: {
                        days: daysMax,
                        year: year,
                        month: month,
                        total: 0,
                        amount: {},
                        usage: []
                    },
                    bandwidth: {
                        days: daysMax,
                        year: year,
                        month: month,
                        total: 0,
                        amount: {},
                        usage: []
                    },
                    manta: {
                        days: daysMax,
                        year: year,
                        month: month,
                        total: 0,
                        amount: {},
                        usage: []
                    }
                };
                results.successes.forEach(function (result) {
                    overallResult.dram.amount[result.date] = 0;
                    overallResult.currentspend.amount[result.date] = 0;
                    overallResult.bandwidth.amount[result.date] = 0;
                    overallResult.manta.amount[result.date] = 0;
                    var bandwidthIn = 0;
                    var bandwidthOut =0;
                    var mantaResult = result.manta;
                    if (mantaResult) {
                        var usage = mantaResult.usage;
                        var requests = usage.DELETERequest + usage.GETRequest + usage.HEADRequest + usage.LISTRequest + usage.OPTIONSRequest + usage.POSTRequest + usage.PUTRequest;
                        bandwidthIn = usage.MantaComputeGBIn + usage.MantaStorageGBIn;
                        bandwidthOut = usage.MantaComputeGBOut + usage.MantaStorageGBOut;
                        overallResult.manta.usage.push({
                            requests: requests,
                            bandwidthIn: Math.max(bandwidthIn,0),
                            bandwidthOut: Math.max(bandwidthOut,0),
                            cost: mantaResult.cost,
                            date: result.date
                        });
                        overallResult.manta.amount[result.date] += mantaResult.cost;
                    }
                    if (result.zones && result.zones.length > 0) {
                        result.zones.forEach(function (zone) {
                            var lastConfig = null;
                            zone.configs.forEach(function (configs) {
                                configs.date = result.date;
                                lastConfig = configs;
                                var ram = (configs.ram / 1024).toFixed(3) * 1;
                                var gbHours = configs.hours * ram;

                                overallResult.dram.usage.push(getUsageDataEntry(zone, configs, {'hours': configs.hours, 'ram' : ram, 'gb-hours': gbHours}));
                                overallResult.currentspend.usage.push(getUsageDataEntry(zone, configs, {'cost': configs.cost}));

                                overallResult.dram.amount[result.date] += gbHours;
                                overallResult.currentspend.amount[result.date] += configs.cost;
                            });
                            bandwidthOut = Math.max(zone.bandwidth.out, 0);
                            bandwidthIn = Math.max(zone.bandwidth.in, 0);
                            overallResult.bandwidth.usage.push(getUsageDataEntry(zone, lastConfig, {'out': bandwidthOut, 'in': bandwidthIn}));
                            overallResult.bandwidth.amount[result.date] += (bandwidthOut + bandwidthIn);
                        });
                    }
                    overallResult.manta.total += overallResult.manta.amount[result.date];
                    overallResult.dram.total += overallResult.dram.amount[result.date];
                    overallResult.currentspend.total += overallResult.currentspend.amount[result.date];
                    overallResult.bandwidth.total += overallResult.bandwidth.amount[result.date];
                    if (overallResult.dram.amount[result.date] === 0) {
                        delete overallResult.dram.amount[result.date];
                    }
                    if (overallResult.currentspend.amount[result.date] === 0) {
                        delete overallResult.currentspend.amount[result.date];
                    }
                    if (overallResult.bandwidth.amount[result.date] === 0) {
                        delete overallResult.bandwidth.amount[result.date];
                    }
                    // grouping by machine as separate pass, cause it's a temporary functionality for old format data
                    var groupByMachineAndSumFields = function (arr, fields) {
                        return arr.sort(function (a, b) {
                            return a.uuid.localeCompare(b.uuid);
                        }).reduce(function (accumulated, newUsage) {
                            var lastElement = accumulated[accumulated.length - 1];
                            if (lastElement && lastElement.uuid === newUsage.uuid) {
                                fields.forEach(function (field) {
                                    lastElement[field] += newUsage[field];
                                    if (newUsage[field] > 0) {
                                        lastElement.first = (lastElement.first > newUsage.first) ? newUsage.first : lastElement.first;
                                        lastElement.last = (lastElement.last < newUsage.last) ? newUsage.last : lastElement.last;
                                    }
                                });
                            } else {
                                accumulated.push(newUsage);
                            }
                            return accumulated;
                        }, []);
                    };
                    overallResult.currentspend.usage = groupByMachineAndSumFields(overallResult.currentspend.usage, ['cost']);
                    overallResult.dram.usage = groupByMachineAndSumFields(overallResult.dram.usage, ['hours', 'gb-hours']);
                    overallResult.bandwidth.usage = groupByMachineAndSumFields(overallResult.bandwidth.usage, ['in', 'out']);
                });
                call.done(null, overallResult);
            });
        }
    });
};