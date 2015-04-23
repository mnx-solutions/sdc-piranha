'use strict';

module.exports = function execute(app, log, config) {
    app.get('/skinChange', function (req, res) {
        var baseUrl = config && config.skinChange && config.skinChange.url || 'https://betaportal.joyent.com';
        var buffer = new Buffer(baseUrl + '/main/#!/dashboard', 'binary');
        console.log(req.session.token);
        var url = baseUrl + '/tfa/saveToken/' + buffer.toString('base64') + '/?token=' + encodeURIComponent(req.session.token);
        res.redirect(url);
    });
};
