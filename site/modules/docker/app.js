"use strict";

var manta = require('manta');
var vasync = require('vasync');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');
    var Docker = scope.api('Docker');

    function DockerHostUnreachable(host) {
        this.message = 'Docker host "' + host + '" is unreachable.';
    }

    function timeFormat(measure) {
        return measure < 10 ? '0' + measure : measure;
    }

    function getTime(str) {
        str += ' ' + new Date().getFullYear();
        var date = new Date(str);
        var time = '';
        if (!isNaN(date.getTime())) {
            time += date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + 'T';
            time += timeFormat(date.getHours()) + ':' + timeFormat(date.getMinutes()) + ':' + timeFormat(date.getSeconds()) + ':' + date.getMilliseconds() + 'Z';
        }
        return time;
    }

    function getLogFormat(log, inputStr) {
        inputStr = inputStr || 'stdout';
        var endBracketPosition = log.indexOf(']') || 1;
        var time = getTime(log.slice(log.indexOf('[') + 1 || 1, endBracketPosition));

        return '{"log": "' + log.slice(endBracketPosition + 2, log.length - 1) + '", "stream":"' + inputStr  + '", "time":"' + time + '"}\n';
    }

    var getFile = function (req, res, action) {
        var messageError;
        var headerType;
        if (action === 'download') {
            messageError = 'Error while downloading file';
            headerType = 'application/octet-stream';
        } else {
            messageError = 'Error while showing file';
            headerType = 'text/plain';
        }
        var client = Manta.createClient({req: req});
        var host = req.query.host;
        var container = req.query.container;
        var path = '~~/stor/.joyent/docker/logs/' + host + '/' + container;
        var filesInDateRange = [];
        var startDate = req.query.start;
        var endDate = req.query.end;
        var ip = req.query.ip;
        var startCurrentDay = Math.ceil(new Date().setHours(0, 0, 0, 0) / 1000);
        function getfilesInDateRange(path, action, callback) {
            client.ftw(path, function (err, entriesStream) {
                if (err) {
                    if (err.statusCode === 404) {
                        return callback(null, []);
                    }
                    return callback(err);
                }

                entriesStream.on('entry', function (obj) {
                    var fileDate = Math.floor(new Date(obj.name.split('.log')[0]).getTime() / 1000);
                    if (startDate <= fileDate && endDate >= fileDate) {
                        filesInDateRange.push(path + '/' + obj.name);
                    }
                });

                entriesStream.on('end', function () {
                    callback(null, filesInDateRange);
                });

                entriesStream.on('error', function (error) {
                    callback(error);
                });
            });
        }

        function secondsToDate(seconds) {
            var customDate = new Date(seconds * 1000);
            var year = customDate.getFullYear();
            var month = customDate.getMonth() + 1 < 10 ? '0' + (customDate.getMonth() + 1) : customDate.getMonth() + 1;
            var date = customDate.getDate() < 10 ? '0' + customDate.getDate() : customDate.getDate();
            customDate = year + '-' + month + '-' + date;
            return customDate.toString();
        }

        function getLogsStream(files, callback) {
            var queue = vasync.queue(function (file, callback) {
                if (file) {
                    var logStream = client.createReadStream(file);
                    logStream.on('data', function (data) {
                        res.write(data);
                    });
                    logStream.on('error', function (error) {
                        req.log.error({error: error}, messageError);
                        callback(error);
                    });
                    logStream.on('end', function () {
                        callback();
                    });
                } else {
                    Docker.createClient({req: req}, {primaryIp: ip}, function (error, client) {
                        if (error) {
                            return callback(error);
                        }
                        client.ping(function (error) {
                            if (error) {
                                return callback(new DockerHostUnreachable(ip));
                            }
                            client.logs({id: container.slice(0, 12), tail: 'all'}, function (err, response) {
                                if (err) {
                                    return callback(err);
                                }
                                if (response && response.length) {
                                    var responses = response.split('\n');
                                    var code;
                                    var logs = '';
                                    var inputStr = null;
                                    responses.pop();
                                    responses.forEach(function (response) {
                                        var i;
                                        for (i = 0; i < response.length; i++) {
                                            code = response.charCodeAt(i);
                                            if (code === 2) {
                                                inputStr = 'stderr';
                                            }
                                            if (code > 4 || code < 2048) {
                                                break;
                                            }
                                        }

                                        logs += getLogFormat(response.substr(i), inputStr);
                                    });
                                    res.write(logs);
                                }
                                callback();
                            });
                        });
                    });
                }
            }, 1);

            files.forEach(function (file) {
                queue.push(file);
            });

            if (endDate >= startCurrentDay) {
                queue.push();
            }

            queue.drain = function () {
                callback();
            };
        }

        getfilesInDateRange(path, action, function (error, filesInDateRange) {
            res.setHeader('Content-Type', headerType);
            if (action === 'download') {
                var filename = req.query.container.substr(0, 12) + '-' + secondsToDate(startDate) + '-' + secondsToDate(endDate) + '.log';
                res.setHeader('Content-Disposition', 'attachment; filename=\"' + filename + '\";"');
            }
            if (error) {
                return res.end(error.message);
            }
            if (filesInDateRange.length > 0 || endDate >= startCurrentDay) {
                getLogsStream(filesInDateRange, function (error) {
                    if (error) {
                        return res.end(error.message);
                    }
                    res.end();
                });
            } else {
                res.end('');
            }
        });

    };

    app.get('/download', function (req, res) {
        getFile(req, res, 'download');
    });

    app.get('/show', function (req, res) {
        getFile(req, res, 'show');
    });
};
