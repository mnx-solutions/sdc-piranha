'use strict';

var config = require('easy-config');

module.exports = function (req, res, next) {
    if (config.features.useBrandingOrange === 'enabled' && req.url === '/' && (!req.session || !req.session._preToken)) {
        res.redirect('/landing/login');
    }
    next();
};