'use strict';

module.exports = {
	route: '/signup',
	index: 'signup.jade',
	modules: [
		'signup',
		'login',
		'menu'
	],
	javascripts: [
		'//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
		'/vendor/bootstrap/js/bootstrap.min.js',
		'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.5/angular.js',
		'/vendor/angular/angular-resource.js',
		'/js/jp.js',
		'/js/app.js',
		'/js/config/routes.js',
		'/js/http-auth-interceptor.js',
		'/js/controllers/main-controller.js',
		'/js/services/request-context.js',
		'/js/values/render-context.js'
	],
	csss: [
		'/vendor/bootstrap/css/bootstrap-responsive.css',
		'/vendor/bootstrap/css/bootstrap.min.css'
	],
	layouts: []
};