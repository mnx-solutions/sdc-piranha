'use strict';

module.exports = {
  route: '/login',
  index: 'login.jade',
  modules: [
    'login'
  ],
  javascripts: [
    '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/vendor/bootstrap/js/bootstrap.min.js',
    '/js/vendor/angular/angular.js',
    '/js/vendor/angular/angular-resource.js',
    '/js/simple-app.js'
  ],
  csss: [
    '/vendor/bootstrap/css/bootstrap.min.css'
  ],
  layouts: [{
      name: 'login',
      include: '/partials/layouts/login.html',
      module: 'login',
      controller: 'LoginController'
    }],
  menu: [{
      name: 'Login',
      link: '/login'
    }]
};