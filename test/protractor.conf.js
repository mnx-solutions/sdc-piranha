require('jasmine-reporters');

var config = require('easy-config').loadConfig({
    folder: __dirname + '/e2e/config/'
});

exports.config = {
    seleniumServerJar: './selenium/selenium-server-standalone-2.37.0.jar',
    chromeDriver: './selenium/chromedriver',
    baseUrl: config.baseUrl,
    includeStackTrace: true,
    verbose: true,
    allScriptsTimeout: 60000,

    capabilities: {
        browserName: config.browser || 'phantomjs',
        'phantomjs.binary.path':'./node_modules/phantomjs/bin/phantomjs'
    },

    specs: [
        '../site/modules/landing/test/landing.scenario.js',
        '../site/modules/**/test/*.scenario.js'
    ],

    params: config.params,

    jasmineNodeOpts: {
        defaultTimeoutInterval: 60000
    },

    onPrepare: function() {
        jasmine.getEnv().addReporter(
            new jasmine.JUnitXmlReporter('reports/xmloutput', true, true));
    }
};

if (config.sauce) {
    if (config.sauce.username.length && config.sauce.key.length) {
        exports.config.sauceUser = config.sauce.username;
        exports.config.sauceKey = config.sauce.key;

    }
}