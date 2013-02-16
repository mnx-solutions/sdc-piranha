
module.exports = {
  route: '/',
  index: 'index.jade',
  modules: [
    'login','password-reset'
  ],
  javascripts: [
   '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/static/vendor/bootstrap/js/bootstrap.min.js',
    '/static/js/angular.js',
    '/static/js/angular-resource.js',
    '/static/js/app.js',
    '/static/js/config/routes.js',
    '/static/js/http-auth-interceptor.js',
    '/static/js/controllers/main-controller.js',
    '/static/js/controllers/landing-controller.js',
    '/static/js/services/request-context.js',
    '/static/js/values/render-context.js'
  ],
  csss: [
    '/static/vendor/bootstrap/css/bootstrap.min.css'
  ],
  layouts: [{
    name:'landing',
    include:'/static/partials/layouts/landing.html',
    module:'main',
    controller:'LandingController'
  }]
};