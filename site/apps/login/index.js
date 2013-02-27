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
		'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.5/angular.js',
		'/vendor/angular/angular-resource.js',
		'/js/http-auth-interceptor.js',
		'/js/jp.js',
		'/js/app.js'
	],
	csss: [
		'/vendor/bootstrap/css/bootstrap.min.css'
	],
	layouts: [
		{
			name: 'login',
			include: '/partials/layouts/login.jade',
			module: 'login',
			controller: 'LoginController'
		}
	]
};