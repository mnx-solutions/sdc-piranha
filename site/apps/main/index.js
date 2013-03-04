module.exports = {
	route: '/',
	index: 'app.jade',
	modules: [
		'menu', 'machine', 'login', 'account'
	],
	authenticate: true,
	javascripts: [
		'//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
		'//raw.github.com/timrwood/moment/2.0.0/min/moment.min.js',
		'/vendor/bootstrap/js/bootstrap.min.js',
		'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.5/angular.js',
		'/vendor/angular/angular-resource.js',
		'/js/jp.js',
		'/js/app.js',
		'/js/config/routes.js',
		'/js/http-auth-interceptor.js',
		'/js/controllers/main-controller.js',
		'/js/controllers/wide-controller.js',
		'/js/services/request-context.js',
		'/js/values/render-context.js',
		'/js/filters/fromNow.js'
	],
	csss: [
		'/vendor/bootstrap/css/bootstrap.min.css',
		'/css/all.css'
	],
	layouts: [
		{
			name: 'wide',
			include: '/partials/layouts/wide.jade'
		}
	]
};