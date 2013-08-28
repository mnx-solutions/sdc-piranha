'use strict';

var restify = require('restify');

module.exports = function execute(scope, app) {
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    app.get('/maxmind/call/:phone', function (req, res, next) {
        var code = getRandomInt(1000, 9999);
        var url = 'https://api.maxmind.com/app/telephone_http?l=bQg6oKXwLfWj&phone=PHONE_NUMBER&verify_code=1234';
        next();
    });
};