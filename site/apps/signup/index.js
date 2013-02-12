
module.exports = {
  route: '/signup',
  index: 'signup.jade',
  modules: [
    'signup'
  ],

  javascripts: [
    '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/static/vendor/bootstrap/js/bootstrap.min.js',
    '/static/js/angular.js',
    '/static/js/app.js',
    '/static/js/controllers/login-controller.js',
    '/static/js/controllers/main-controller.js',
    '/static/js/directives/auth-interceptor.js',
    '/static/js/http-auth-interceptor.js',
    '/static/js/services/request-context.js',
    '/static/js/values/render-context.js'
  ],

  csss: ['/static/vendor/bootstrap/css/bootstrap.min.css'],
  layouts: []
};