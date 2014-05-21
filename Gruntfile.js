"use strict";
var exec = require('child_process').exec;
var fs = require('fs');

module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-contrib-jasmine');
    grunt.loadNpmTasks('grunt-protractor-runner');
    grunt.loadNpmTasks('grunt-shell-spawn');
    grunt.loadNpmTasks('grunt-contrib-watch');

    var diffCommand = 'git diff-index --name-only --diff-filter=AM HEAD -- | grep .js';

    grunt.initConfig({
        init: {
            precommitDest: './.git/hooks/pre-commit',
            precommit: './tools/pre-commit'
        },

        watch: {
            protractor: {
                files: [
                    'site/modules/**/test/*.scenario.js',
                    'test/e2e/**/*.js'
                ],
                tasks: [ 'protractor:auto' ]
            }
        },

        shell: {
            options: {
                stdout: true
            },

            selenium: {
                command: './selenium/start',
                options: {
                    stdout: false,
                    async: true
                }
            },

            protractor_install: {
                command: 'node ./node_modules/protractor/bin/install_selenium_standalone'
            }
        },

        deps: {
            jsLint: {
                path: 'deps/javascriptlint',
                url: 'git://github.com/davepacheco/javascriptlint.git'
            },
            jsStyle: {
                path: 'deps/jsstyle',
                url: 'git://github.com/davepacheco/jsstyle.git'
            },
            restDown: {
                path: 'deps/restdown',
                url: 'git://github.com/trentm/restdown'
            }
        },

        jsLintChanges: {},

        jsLint: {
            diff: {
                path: './<%= deps.jsLint.path %>/build/install/jsl',
                files: {
                    src: []
                },
                conf: './tools/jsl.node.conf',
                options: '--nologo --nofilelisting'
            },
            node: {
                path: './<%= deps.jsLint.path %>/build/install/jsl',
                files: {
                    src: [
                        '**/*.js',
                        '!**/node_modules/**',
                        '!**/deps/**',
                        '!**/static/**',
                        '!**/test/**',
                        '!**/*.spec.js'
                    ]
                },
                conf: './tools/jsl.node.conf',
                options:
                    '--nologo --nofilelisting --conf=<%= jsLint.node.conf %>'
            },
            client: {
                path: './<%= deps.jsLint.path %>/build/install/jsl',
                files: {
                    src: [
                        '**/static/**/*.js',
                        '!**/node_modules/**',
                        '!**/vendor/**',
                        '!**/*.spec.js',
                        '!site/modules/tracking/static/js/munchkin.js'
                    ]
                },
                conf: './tools/jsl.web.conf',
                options:
                    '--nologo --nofilelisting --conf=<%= jsLint.client.conf %>'
            }
        },

        jsStyle: {
            diff: {
                path: './<%= deps.jsStyle.path %>/jsstyle',
                conf: './tools/jsstyle.conf',
                options: '-f <%= jsStyle.client.conf %>',
                files: {
                    src: []
                }
            },
            node: {
                path: './<%= deps.jsStyle.path %>/jsstyle',
                conf: './tools/jsstyle.conf',
                options: '-f <%= jsStyle.client.conf %>',
                files: {
                    src: [
                        '**/*.js',
                        '!**/node_modules/**',
                        '!**/deps/**',
                        '!**/static/**',
                        '!**/test/**',
                        '!**/*.spec.js'
                    ]
                }
            },
            client: {
                path: './<%= deps.jsStyle.path %>/jsstyle',
                conf: './tools/jsstyle.conf',
                options: '-f <%= jsStyle.client.conf %>',
                files: {
                    src: [
                        '**/static/**/*.js',
                        '!**/node_modules/**',
                        '!**/vendor/**',
                        '!**/*.spec.js'
                    ]
                }
            }

        },


        karma: {
            unit: {
                configFile: './test/karma.conf.js',
                autoWatch: false,
                singleRun: true
            },
            unit_auto: {
                configFile: './test/karma.conf.js',
                autoWatch: true,
                singleRun: false
            }
        },

        protractor: {
            options: {
                keepAlive: false,
                configFile: './test/protractor.conf.js'
            },

            singlerun: {},

            auto: {
                keepAlive: true,
                options: {
                    args: {
                        seleniumPort: 4444
                    }
                }
            }
        }
    });

    grunt.registerMultiTask('deps', 'set up dependencies', function () {
        var command = 'git clone ' + this.data.url + ' ' + this.data.path;

        var done = this.async();
        var self = this;
        exec(command, function (error, stdout) {
            console.log(stdout);
            // if jsLint, we need to install it
            if (self.target === 'jsLint') {
                exec('make install',
                    {cwd: self.data.path},
                    function (err, stdoutInstall) {
                        console.log(stdoutInstall);
                        done();
                    });

            } else {
                done();
            }
        });

    });

    grunt.registerTask('npmDeps', 'set up npm dependencies', function () {
        var command = 'npm install';

        var done = this.async();
        exec(command, function (error, stdout) {
            console.log(stdout);
            done();
        });

    });

    // task for setting up deps and git hook for testing
    grunt.registerTask('init', 'set up', function () {
        var done = this.async();

        grunt.task.run('deps');
        grunt.task.run('npmDeps');

        var precommit = grunt.config('init.precommit');
        var precommitDest = grunt.config('init.precommitDest');

        fs.exists(precommitDest, function (exists) {
            if (!exists) {
                grunt.file.copy(precommit, precommitDest);
                exec('chmod +x ' + precommitDest);
            }
            done();
        });

    });

    function getErrors(stdout, useStrictErr) {
        var messages = stdout[stdout.length - 2].split(', ');
        var warnings = parseInt(messages.pop(), 10);

        if (warnings - useStrictErr > 0) {
            messages[1] = (warnings - useStrictErr) + ' warning(s)';
            messages.push(useStrictErr + ' use Strict warning(s)');
            return messages.join(', ');
        }

        return false;
    }

    function useStrictFilter(line) {
        return !(line.indexOf('(1):') !== -1 &&
            line.indexOf('want_assign_or_call') !== -1);

    }

    // task for running javascript lint for node files and
    // client-side files with separate conf
    //
    // Since current configs throw warnings on "use strict" common usage,
    // this task includes a hack to ignore use strict warnings,
    // they are identified by line 1 and errorflag "want_assign_or_call"
    // (see getErrors and useStrictFilter functions)
    //
    grunt.registerMultiTask('jsLint', 'javascript lint', function () {

        var done = this.async();
        var files = this.filesSrc;
        var self = this;
        function runLinter(files, conf, callback) {
            conf = conf || 'node';
            var command = self.data.path + ' ' + self.data.options + ' --conf=./tools/jsl.' + conf + '.conf ' + files.join(' ');
            exec(command, function (lintError, stdout, stderr) {

                if (stderr) {
                    throw new Error(stderr);
                }

                var errors = false;

                var stdoutList = stdout.split('\n');
                var newStd = stdoutList.filter(useStrictFilter);
                var useStrictErr = stdoutList.length - newStd.length;

                var output = newStd.slice(0, newStd.length - 2).join('\n');
                grunt.log.writeln(output);

                if (lintError) {
                    errors = getErrors(newStd, useStrictErr);
                }
                if (errors) {
                    grunt.log.error(errors);
                    grunt.warn('fix Lint issues before continuing');
                } else {
                    if (useStrictErr) {
                        grunt.log.writeln('>> ' + useStrictErr + ' use strict warning(s)');
                    }
                    grunt.log.ok(files.length +
                        ' file' + (files.length === 1 ? '' : 's') +
                        ' without fatal warnings/errors.');
                }
                if (!callback) {
                    done();
                }

            });
        }
        if (this.target === 'diff') {
            exec(diffCommand, function (error, stdout) {
                files = stdout.split(/\n/).slice(0, -1);
                var jsLintConfig = grunt.config.data.jsLint;
                var calls = 2;
                var nodeFiles = grunt.file.match(jsLintConfig.node.files.src, files);
                var webFiles = grunt.file.match(jsLintConfig.client.files.src, files);
                var callback = function () {
                    calls -= 1;
                    if (!calls) {
                        done();
                    }
                };
                runLinter(nodeFiles, 'node', callback);
                runLinter(webFiles, 'web', callback);
            });
        } else {
            runLinter(files);
        }
    });

    // task for running javascript style check

    grunt.registerMultiTask('jsStyle', 'javascript style check', function () {

        var done = this.async();
        var files = this.filesSrc;
        var self = this;
        function runStyler() {
            var command = self.data.path + ' ' + self.data.options + ' ' + files.join(' ');
            exec(command, function(styleError, stdout, stderr) {

                if (stderr) {
                    throw new Error(stderr);
                }

                grunt.log.writeln(stdout);

                if (styleError) {
                    grunt.log.error(stdout.split('\n').length - 1 + ' warnings');
                    grunt.warn('fix Style issues before continuing');
                } else {
                    grunt.log.ok(files.length +
                        ' file' + (files.length === 1 ? '' : 's') +
                        ' without fatal warnings/errors.');
                }

                done();

            });
        }

        if (this.target === 'diff') {
            exec(diffCommand, function(error, stdout) {
                files = stdout.split(/\n/);
                files.pop();
                runStyler();
            });
        } else {
            runStyler();
        }

    });

    grunt.registerTask('default', [ 'jsLint', 'jsStyle', 'test' ]);
    grunt.registerTask('check', [ 'jsLint', 'jsStyle' ]);
    grunt.registerTask('precommit', ['jsLint:diff']);
    grunt.registerTask('prepush', [ 'jsLint', 'jsStyle', 'test' ]);

    grunt.registerTask('install:dev', [ 'shell:protractor_install' ]);

    // Single run tests
    grunt.registerTask('test', [ 'test:unit', 'test:e2e' ]);
    grunt.registerTask('test:unit', [ 'karma:unit' ]);
    grunt.registerTask('test:e2e', [ 'protractor:singlerun' ]);

    // Autotest and watch tests
    grunt.registerTask('autotest', [ 'karma:unit_auto' ]);
    grunt.registerTask('autotest:unit', [ 'karma:unit_auto' ]);
    grunt.registerTask('autotest:e2e', [ 'shell:selenium', 'watch:protractor' ]);
};