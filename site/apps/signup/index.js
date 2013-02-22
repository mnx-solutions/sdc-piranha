
module.exports = {
  route: '/signup',
  index: 'signup.jade',
  modules: [
    'signup',
    'login'
  ],
  javascripts: [
    '//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
    '/vendor/bootstrap/js/bootstrap.min.js',
    '/js/angular.js',
    '/js/angular-resource.js',
    '/js/simple-app.js',
    '/js/controllers/main-controller.js',
    '/js/services/request-context.js',
    '/js/values/render-context.js'
  ],
  csss: ['/vendor/bootstrap/css/bootstrap.min.css', '/css/css.less'],
  layouts: []
};