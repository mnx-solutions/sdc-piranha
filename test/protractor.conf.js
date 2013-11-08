var config = require('easy-config').loadConfig({
    folder: __dirname + '/e2e/config/'
});

exports.config = {
    //seleniumAddress: 'http://localhost:4444/wd/hub',
    seleniumServerJar: './selenium/selenium-server-standalone-2.35.0.jar',
    chromeDriver: './selenium/chromedriver',
    baseUrl: config.baseUrl,
    includeStackTrace: true,
    verbose: true,
    capabilities: {
        'browserName': 'chrome'
    },
    specs: [
        '../site/modules/landing/test/landing.scenario.js',
        '../site/modules/**/test/*.scenario.js'
    ],

    jasmineNodeOpts: {
        reporter: 'progress',
        showColors: true,
        defaultTimeoutInterval: 60000
    }
};