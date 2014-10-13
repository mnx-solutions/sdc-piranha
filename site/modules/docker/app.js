"use strict";

var manta = require('manta');
var vasync = require('vasync');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');

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
        var path = '~~/stor/.joyent/docker/logs/' + req.query.host + '/' + req.query.container;
        var filesInDateRange = [];
        var startDate = req.query.start;
        var endDate = req.query.end;
        function getfilesInDateRange(path, action, callback) {
            client.ftw(path, function (err, entriesStream) {
                if (err) {
                    return callback(err);
                }

                entriesStream.on('entry', function (obj) {
                    var fileDate = Math.floor(new Date(obj.name.split('.log')[0]).getTime()/1000);
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
            }, 1);

            files.forEach(function (file) {
                queue.push(file);
            });

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
            if (filesInDateRange.length > 0) {
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
