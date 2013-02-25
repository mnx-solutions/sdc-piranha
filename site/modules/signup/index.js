'use strict';

var express = require('express');
var app = express();

module.exports.app = app;

module.exports.csss = [ 'css/main.css' ];
module.exports.javascripts = [
  'js/navigation-item.js',
  'js/navigation-collection.js',
  'js/controllers/signup-layout.js',
  'js/controllers/account.js',
  'js/controllers/verification.js',
  'js/controllers/payment.js',
  'js/controllers/signup.js',
  'js/config/routes.js',
  'js/services/navigation.js'
];

module.exports.layouts = [{
    name: 'signup',
    include: 'partial/signup.html',
    controller: 'SignupLayoutController'
}];