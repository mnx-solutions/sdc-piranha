
module.exports = {
  route: '/signup',
  index: 'signup.jade',
  modules: [
    'signup',
    'login'
  ],

  javascripts: [
    '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/static/vendor/bootstrap/js/bootstrap.min.js',
    '/static/js/angular.js',
    '/static/js/angular-resource.js',
    '/static/js/simple-app.js',
    '/static/js/controllers/main-controller.js',
    '/static/js/services/request-context.js',
    '/static/js/values/render-context.js'
  ],

  csss: ['/static/vendor/bootstrap/css/bootstrap.min.css'],
  layouts: []
};