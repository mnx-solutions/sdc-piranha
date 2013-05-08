var exec = require('child_process').exec;
var fs = require('fs');
module.exports = function(grunt) {

    grunt.initConfig({
        init: {
            precommitDest: './.git/hooks/pre-commit',
            precommit: './tools/pre-commit'
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
        jsLint: {
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
                options: '--nologo --nofilelisting --conf=<%= jsLint.node.conf %>'
            },
            client: {
                path: './<%= deps.jsLint.path %>/build/install/jsl',
                files: {
                    src: [
                        '**/static/**/*.js',
                        '!**/node_modules/**',
                        '!**/vendor/**',
                        '!**/*.spec.js'
                    ]
                },
                conf: './tools/jsl.web.conf',
                options: '--nologo --nofilelisting --conf=<%= jsLint.client.conf %>'
            }
        },
        jsStyle: {
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
        jasmineNode: {
            directory: './'
        },
        jasmine: {
            tests: {
                src: [
                    "site/static/vendor/angular/angular.js",
                    "site/static/vendor/angular/angular-resource.js",
                    "site/static/vendor/angular/angular-cookies.js",
                    "test/angular-mocks.js",
                    "site/static/js/jp.js",
                    "site/static/js/*.js",
                    "site/static/js/**/*.js",
                    "site/modules/**/static/js/module.js",
                    "site/modules/**/static/js/**/*.js",
                    "site/modules/**/static/vendor/**/*.js",
                    "**/modules/machine/**/test/mock/*.js"
                ],
                options: {
                    specs: [
                        "site/modules/**/test/*.js"
                    ]
                }
            }
        }
    });

    grunt.registerMultiTask('deps', 'set up dependencies', function() {
        var command = 'git clone ' + this.data.url + ' ' + this.data.path;

        var done = this.async();
        var self = this;
        exec(command, function(error, stdout, stderr) {
            console.log(stdout);
            // if jsLint, we need to install it
            if (self.target === 'jsLint') {
                exec('make install',
                    {cwd: self.data.path},
                    function(err, stdoutInstall, stderrInstall) {
                        console.log(stdoutInstall);
                        done();
                    });

            } else {
                done();
            }
        });

    });

    grunt.registerTask('npmDeps', 'set up npm dependencies', function() {
        var command = 'npm install';

        var done = this.async();
        exec(command, function(error, stdout, stderr) {
            console.log(stdout);
            done();
        });

    });

    // task for setting up deps and git hook for testing
    grunt.registerTask('init', 'set up', function() {
        var done = this.async();

        grunt.task.run('deps');
        grunt.task.run('npmDeps');

        var precommit = grunt.config('init.precommit');
        var precommitDest = grunt.config('init.precommitDest');

        fs.exists(precommitDest, function(exists) {
            if (!exists) {
                grunt.file.copy(precommit, precommitDest);
                exec('chmod +x ' + precommitDest);
            }
            done();
        });

    });

    // npm Task for running client-side jasmine tests
    grunt.loadNpmTasks('grunt-contrib-jasmine');

    // task for running jasmine-node with tap reporter
    grunt.registerTask('jasmineNode',
        'jasmine testing for node',
        function() {

            var done = this.async();
            var dir = grunt.config('jasmineNode.directory');
            var command = 'node ./test/jasmine-wrapper.js ' + dir + ' --verbose';

            exec(command, function(testError, stdout, stderr) {
                if (stderr) {
                    throw new Error(stderr);
                }

                grunt.log.writeln(stdout);

                if (testError) {
                    grunt.warn('fix issues before continuing');
                } else {
                    grunt.log.ok('All tests passed!');
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
        if (line.indexOf('(1):') !== -1 && line.indexOf('want_assign_or_call') !== -1)
            return false;

        return true;
    }

    // task for running javascript lint for node files and
    // client-side files with separate conf
    //
    // Since current configs throw warnings on "use strict" common usage,
    // this task includes a hack to ignore use strict warnings,
    // they are identified by line 1 and errorflag "want_assign_or_call"
    // (see getErrors and useStrictFilter functions)
    //
    grunt.registerMultiTask('jsLint', 'javascript lint', function() {

        var done = this.async();
        var files = this.filesSrc;
        var command = this.data.path + ' ' + this.data.options + ' ' + files.join(' ');

        exec(command, function(lintError, stdout, stderr) {

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

            done();

        });

    });

    // task for running javascript style check

    grunt.registerMultiTask('jsStyle', 'javascript style check', function() {

        var done = this.async();
        var files = this.filesSrc;
        var command = this.data.path + ' ' + this.data.options + ' ' + files.join(' ');

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

    });

// register tasks as they should be in the makefile
    grunt.registerTask('default', ['jsLint', 'jsStyle', 'test']);
    grunt.registerTask('check', ['jsLint', 'jsStyle']);
//  grunt.registerTask('clean', '');
    grunt.registerTask('prepush', ['jsLint', 'jsStyle', 'test']);
    grunt.registerTask('test', ['jasmineNode', 'jasmine']);
//  grunt.registerTask('release', ['jsLint', 'jsStyle test']);

};