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

    var getStats = function (statObj, callback) {
        client.get(statObj.url, function (err, stream) {
            if (err && err.statusCode !== 404) {
                callback('Error reading stats');
                return;
            }
            var finalResult = function (obj) {
                callback(null, {date: statObj.date, entries: obj});
            };
            if (stream) {
                var result = '';
                stream.setEncoding('utf8');
                stream.on('data', function (chunk) {
                    result += chunk;
                });
                stream.on('end', function () {
                    var resultLines = result.match(/[^\r\n]+/g);
                    finalResult(JSON.parse('[' + resultLines.join(',') + ']'));
                });
            } else {
                finalResult([]);
            }
        });
    };

    var daysInMonth = function (year, month) {
        return new Date(year, month, 0).getDate();
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
            for (var day = 1; day <= daysMax; day++) {
                var customerId = config.usageData && config.usageData.userId || call.req.session.userId;
                var paddedMonth = pad(month);
                var paddedDay = pad(day);
                var statUrl = '/chronos/stor/usage_reports/customer/' + year + '/' + paddedMonth +
                    '/' + paddedDay + '/' + customerId + '.json';
                statUrls.push({url: statUrl, date: year + '-' + paddedMonth + '-' + paddedDay});
            }
            vasync.forEachParallel({
                func: getStats,
                inputs: statUrls
            }, function (err, results) {
                var overallResult = {
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
                    }
                };
                results.successes.forEach(function (result) {
                    overallResult.dram.amount[result.date] = 0;
                    overallResult.bandwidth.amount[result.date] = 0;
                    var networksToMachine = {};
                    if (result.entries && result.entries.length > 0) {
                        result.entries.forEach(function (entry) {
                            var machineId = entry.uuid;
                            entry.configs.forEach(function (config) {
                                var machine = config.config;
                                machine.uuid = machineId;
                                networksToMachine[machine.nics.net0] = machine;
                                var hours = (new Date(config.last).getTime() - new Date(config.first).getTime()) / 3600000;
                                overallResult.dram.usage.push({
                                    uuid: machine.uuid,
                                    alias: machine.alias,
                                    package_uuid: machine.package.uuid,
                                    package_name: machine.package.name,
                                    hours: hours,
                                    ram: machine.live.ram
                                });
                                overallResult.dram.amount[result.date] += config.config.live.ram * hours / 1000;
                            });
                            for (var network in entry.network_usage) {
                                var machine = networksToMachine[network];
                                if (machine) {
                                    entry.network_usage[network].forEach(function (usage) {
                                        var bytesin = usage.last.recv - usage.first.recv;
                                        var bytesout = usage.last.sent - usage.first.sent;
                                        bytesin = bytesin < 0 ? 0 : bytesin;
                                        bytesout = bytesout < 0 ? 0 : bytesout;
                                        overallResult.bandwidth.usage.push({
                                            uuid: machine.uuid,
                                            alias: machine.alias,
                                            package_uuid: machine.package.uuid,
                                            package_name: machine.package.name,
                                            out: bytesout,
                                            in: bytesin
                                        });
                                        overallResult.bandwidth.amount[result.date] += (bytesin + bytesout);
                                    });
                                }
                            }
                        });
                    }
                    overallResult.dram.total += overallResult.dram.amount[result.date];
                    overallResult.bandwidth.total += overallResult.bandwidth.amount[result.date];
                    if (overallResult.dram.amount[result.date] === 0) {
                        delete overallResult.dram.amount[result.date];
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
                                })
                            } else {
                                accumulated.push(newUsage);
                            }
                            return accumulated;
                        }, []);
                    };
                    overallResult.dram.usage = groupByMachineAndSumFields(overallResult.dram.usage, ['hours']);
                    overallResult.bandwidth.usage = groupByMachineAndSumFields(overallResult.bandwidth.usage, ['in', 'out']);
                });
                call.done(null, overallResult);
            });
        }
    });
}