'use strict';

var config = require('easy-config');

module.exports = function (req, res, next) {
    if (config.features.useBrandingOrange === 'enabled' && req.url === '/') {
        res.redirect('/landing/login');
    }
    next();
};