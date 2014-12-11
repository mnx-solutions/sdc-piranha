"use strict";

var path = require('path');
var manta = require('manta');
var vasync = require('vasync');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');
    var Docker = scope.api('Docker');

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
        var logPath = '~~/stor/.joyent/docker/logs/' + host + '/' + container;
        var filesInDateRange = [];
        var startDate = new Date(req.query.start).getTime() / 1000;
        var endDate = new Date(req.query.end).getTime() / 1000 + 86400;
        var ip = req.query.ip;
        var startCurrentDay = Math.ceil(new Date().setUTCHours(0, 0, 0, 0) / 1000);

        function getfilesInDateRange(logPath, action, callback) {
            client.ftw(logPath, function (err, entriesStream) {
                if (err) {
                    if (err.statusCode === 404) {
                        return callback(null, []);
                    }
                    return callback(err);
                }

                entriesStream.on('entry', function (obj) {
                    var fileDate = Math.floor(new Date(path.basename(obj.name, '.log')).getTime() / 1000);

                    if (startDate <= fileDate && endDate >= fileDate) {
                        filesInDateRange.push(logPath + '/' + obj.name);
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

        function unixtimeToDate(seconds) {
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
                    Docker.createClient({req: req}, {primaryIp: ip, id: host}, function (error, client) {
                        if (error) {
                            return callback(error);
                        }
                        client.ping(function (error) {
                            if (error) {
                                return callback(new Docker.DockerHostUnreachable({primaryIp: ip}));
                            }
                            client.logs({id: container, tail: 'all'}, function (err, response) {
                                if (err) {
                                    return callback(err);
                                }
                                var logs = '';
                                if (response && response.length) {
                                    logs = Docker.parseLogResponse(response);
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

        getfilesInDateRange(logPath, action, function (error, filesInDateRange) {
            res.setHeader('Content-Type', headerType);
            if (action === 'download') {
                var filename = req.query.container.substr(0, 12) + '-' + unixtimeToDate(startDate) + '-' + unixtimeToDate(endDate) + '.log';
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
