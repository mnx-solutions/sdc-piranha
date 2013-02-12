
module.exports = {
  route: '/login',
  index: 'login.jade',
  modules: [
    'login'
  ],
  javascripts: [
   '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/static/vendor/bootstrap/js/bootstrap.min.js',
    '/static/js/angular.js',
    '/static/js/angular-resource.js',
    '/static/js/simple-app.js'
  ],
  csss: [
    '/static/vendor/bootstrap/css/bootstrap.min.css'
  ],
  layouts: [{
    name:'login',
    include:'/static/partials/layouts/login.html',
    module:'login',
    controller:'LoginController'
  }]
};