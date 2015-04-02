'use strict';

var config = require('easy-config');

module.exports = function execute(scope, app) {
    app.get('/skinChange', function (req, res) {
        var baseUrl = config && config.skinChange && config.skinChange.url || 'https://betaportal.joyent.com';
        var buffer = new Buffer(baseUrl + '/main/#!/dashboard', 'binary');
        console.log(req.session.token);
        var url = baseUrl + '/tfa/saveToken/' + buffer.toString('base64') + '/?token=' + encodeURIComponent(req.session.token);
        res.redirect(url);
    });
};
