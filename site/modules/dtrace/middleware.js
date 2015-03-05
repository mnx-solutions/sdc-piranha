'use strict';
var config = require('easy-config');
if (!config.features || config.features.dtrace !== 'enabled') {
    return;
}

module.exports = function execute() {
    return {
        index: [
            function (req, res, next) {
                res.locals.js.push({_url: 'https://cdn.socket.io/socket.io-1.2.0.js'});
                return next();
            }
        ]
    };
};
