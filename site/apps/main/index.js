
module.exports = {
	route: '/home',
	index: 'home.jade',
	modules: [
		'login','password-reset','menu','signup','machine'
	],

	javascripts: [
		'//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
		'//raw.github.com/timrwood/moment/2.0.0/min/moment.min.js',
		'/static/vendor/bootstrap/js/bootstrap.min.js',
		'/static/js/angular.js',
		'/static/js/angular-resource.js',
		'/static/js/app.js',
		'/static/js/config/routes.js',
		'/static/js/http-auth-interceptor.js',
		'/static/js/controllers/main-controller.js',
		'/static/js/controllers/wide-controller.js',
		'/static/js/services/request-context.js',
		'/static/js/values/render-context.js',
		'/static/js/filters/fromNow.js'
	],

	csss: [
		'/static/vendor/bootstrap/css/bootstrap.min.css'
	],

	layouts: [{
		name: 'wide',
		include: '/static/partials/layouts/wide.html'
	}]
};