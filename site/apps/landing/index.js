
module.exports = {
	route: '/',
	index: 'landing.jade',
	modules: [
		'account'
	],
	javascripts: [
		'//ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js',
		'/vendor/bootstrap/js/bootstrap.min.js',
		'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.5/angular.js',
		'/vendor/angular/angular-resource.js',
		'/js/jp.js',
		'/js/app.js',
		'/js/config/routes.js',
		'/js/http-auth-interceptor.js',
		'/js/controllers/main-controller.js',
		'/js/controllers/landing-controller.js',
		'/js/services/request-context.js',
		'/js/values/render-context.js'
	],
	csss: [
		'/vendor/bootstrap/css/bootstrap.min.css'
	],
	layouts: [{
		name: 'landing',
		include: '/partials/layouts/landing.jade',
		module: 'main',
		controller: 'LandingController'
	}]
};