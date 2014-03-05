'use strict';

var restify = require('restify');
var config = require('easy-config');

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function getPinByPhone(req, res, next) {
    // adding headers to enable access to the resources served from a different domain or a different server port
    res.setHeader('Access-Control-Allow-Origin', '*');
    var pin = req.query.verify_code;
    var phone = req.query.phone;
    if (phone.length < 10) {
        res.send(200, 'err=PhoneNumber Parameter');
    } else {
        res.send(200, 'err=' + pin);
    }
    return next();
}

var server = restify.createServer();
//sets up all of the default headers and parsing url
server.use(restify.fullResponse()).use(restify.bodyParser()).use(restify.queryParser());
server.get(RegExp(escapeRegExp('app/telephone_http')), getPinByPhone);

server.listen(1234);
