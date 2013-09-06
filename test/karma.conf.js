module.exports = function(config) {
    config.set({
        basePath : '../',
        frameworks : ["jasmine", "ng-scenario"],
        files : [
            "http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js",
            "site/static/vendor/bootstrap/js/bootstrap.min.js",
            "site/static/vendor/angular/angular.js",
            "site/static/vendor/angular/angular-resource.js",
            "site/static/vendor/angular/angular-cookies.js",
            "site/static/vendor/angular/angular-cookies.js",
            "site/static/vendor/bootstrap/js/*.js",
            "site/static/js/jp.js",
            "site/static/js/app.js",
            "site/static/js/config/routes.js",
            "site/static/js/http-auth-interceptor.js",
            "site/static/js/controllers/main-controller.js",
            "site/static/js/services/*.js",
            "site/static/js/values/render-context.js",
            "test/angular-mocks.js",
            "site/modules/**/static/js/module.js",
            "site/modules/**/static/js/**/*.js",
            "site/modules/**/static/vendor/**/*.js",
            "test/spec/**/*.js"
        ],
        autoWatch : true,
        browsers : ['PhantomJS'],
        plugins: [
            "karma-jasmine",
            "karma-phantomjs-launcher",
            "karma-chrome-launcher",
            "karma-ng-scenario",
        ]
    });
};