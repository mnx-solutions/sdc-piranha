'use strict';

module.exports = function execute(app) {
    var info = require('../cms').Info;

    app.get('/:name', function (req, res, next) {
        if (info[req.params.name] && info[req.params.name].pointer._ext === 'html') {
            res.send(info[req.params.name].data);
            return;
        }
        res.sendStatus(404);
    });
};
