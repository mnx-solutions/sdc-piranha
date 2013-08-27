'use strict';

// Mappings
var oldUrls = {
    '/billing/paymentmethod': '/main/#!/account/payment',
    '/machines' : '/main/#!/instance',
    '/account': '/main/#!/account',
    '/favicon.ico': '/static/img/favicon.ico'
};

module.exports = function (app) {
    app.use(function (req, res, next) {
        if (oldUrls[req.originalUrl]) {
            res.redirect(oldUrls[req.originalUrl]);
            return;
        }
        next();
    });

    app.get('/:datacenter/machines/:id', function (req, res, next) {
        res.redirect('/main/#!/instance/details/' + req.params.id);
        return;
    });
};