//wrapper for jasmine-node to include tap reporter
require('jasmine-node');
require('./tap-reporter.js');
jasmine.getEnv().addReporter(new jasmine.TapReporter());
require('../node_modules/jasmine-node/lib/jasmine-node/cli.js');