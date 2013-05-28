'use strict';

module.exports = function execute(scope, app) {
    var info = scope.api('Info');

    app.get('/:name', function (req, res, next) {
        if(info[req.params.name] && info[req.params.name].pointer._ext === 'html') {
            res.send(info[req.params.name].data);
            return;
        }
        res.send(404);
    });
};