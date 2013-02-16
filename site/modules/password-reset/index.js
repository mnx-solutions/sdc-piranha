'use strict';

var express = require('express');
var app = express();

app.get('/request_reset', function(req, res){
    console.log("signup app created")
});

app.get('/password_reset/:uuid/:code', function(req, res){
    console.log("signup app created")
});

module.exports.app = app;

module.exports.setlog = function(_log){
 log = _log;
}

module.exports.css = ['css/reset.css'];
module.exports.javascripts = [
  'js/modal.js',
  'js/controllers/reset-controller.js',
  'js/directives/reset-form.js'
];
