module.exports = function (config) {
    config.set({
        basePath: '../',
        frameworks: [ 'jasmine' ],

        files: [
            "https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js",
            "site/static/vendor/angular/angular.js",
            "site/static/vendor/angular/angular-resource.js",
            "site/static/vendor/angular/angular-cookies.js",
            "site/static/vendor/angular/angular-mocks.js",
            "site/static/vendor/zendesk/zenbox.js",
            "site/static/vendor/bootstrap/js/angular-ui.js",
            "site/static/vendor/bootstrap/js/bootstrap.min.js",
            "site/static/vendor/bootstrap/js/dialog.js",
            "site/static/vendor/bootstrap/js/transition.js",
            "site/static/vendor/moment/moment.min.js",
            "site/static/vendor/uuid/uuid.js",

            "site/static/js/jp.js",
            "site/modules/**/static/js/module.js",
            "site/static/js/*.js",
            "site/static/js/**/*.js",
            "site/modules/**/static/js/**/*.js",
            "site/modules/**/static/vendor/**/*.js",
            "**/modules/machine/**/test/mock/*.js",

            "site/modules/**/test/*.spec.js"
        ],

        singleRun: true,
        browsers: [ 'Chrome' ],
        reporters: 'progress',

        plugins: [
            'karma-jasmine',
            'karma-phantomjs-launcher',
            'karma-chrome-launcher'
        ]
    });
};