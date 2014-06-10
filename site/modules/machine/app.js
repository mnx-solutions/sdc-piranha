'use strict';

var TEMP = {};
var moment = require('moment');

function setTempData(data, id) {
    TEMP[id] = data;
    TEMP[id].__timeout = setTimeout(function () {
        delete TEMP[id];
    }, 10000);
}

function readTempData(id) {
    if(!TEMP[id]) {
        return false;
    }

    clearTimeout(TEMP[id].__timeout);
    var data = TEMP[id];
    delete TEMP[id];
    return data;
}

module.exports = function (scope, app) {
    app.post('/export', function (req, res, next) {
        var id = Math.random().toString(36).substr(2);

        setTempData(req.body, id);
        res.send(id);
    });

    app.get('/export/:id/:format/:type', function (req, res, next) {
        var data = readTempData(req.params.id);
        if(!data) {
            res.send(404);
            return;
        }
        var type = '';
        var prefix  = 'joyent-';
        if (req.params.type) {
            type = req.params.type;
        }

        switch(type) {
            case 'firewall':
                prefix += 'fw-rules-';
                break;
            case 'image':
                prefix += 'images-';
                break;
            case 'machine':
                prefix += 'instances-';
                break;
            case 'user':
                prefix += 'users-';
                break;
            default:
                break;
        }


        var format = req.params.format.toLowerCase();
        var fname = 'attachment; filename=' + prefix + moment().format('YYYY-MM-DD-hh-mm-ss') + '.' + format;
        var fcontent = '';
        switch(format) {
            case 'json':
                fcontent = JSON.stringify(data.data);
                break;
            case 'csv':
                var lines = ['sep=;'];
                lines.push(data.order.join(';'));
                data.data.forEach(function (el) {
                    var line = [];
                    data.order.forEach(function (p) {
                        line.push(JSON.stringify(el[p]));
                    });
                    lines.push(line.join(';'));
                });
                fcontent = lines.join('\n');
                break;
            default:
                res.send(400, 'Unsupported format');
                break;
        }
        res.header('Content-Type', 'application/octet-stream');
        res.header('Content-Disposition', fname);
        res.end(fcontent);
    });
};