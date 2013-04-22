'use strict';

module.exports = function (scope, app, callback) {
    var info = scope.api('Info');

    app.get('/', function (req, res, next) {
        var infoObj = {};
        Object.keys(info).forEach(function (key) {
            infoObj[key] = info[key].data;
        });
        res.json(infoObj);
    });

    app.post('/:name', function (req, res, next) {
        if (!info[req.params.name]) {
            res.send(404);
            return;
        }
        if(typeof req.body !== 'object') {
            res.send(400);
            return;
        }

        info[req.params.name].save(req.body, function (err) {
            if(err) {
                res.send(500, err);
                return;
            }
            res.send(200);
        });
    });

    setImmediate(callback);
};