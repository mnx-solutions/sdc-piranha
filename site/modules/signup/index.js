'use strict';

var express = require('express');
var app = express();

module.exports.app = app;

module.exports.css = ['css/main.css'];
module.exports.javascripts = [
  'js/controllers/signup-controller.js',
  'js/config/routes.js'
];

module.exports.layouts = [{
    name: 'signup',
    include:'partial/signup.html',
    controller:'SignupController'
}];