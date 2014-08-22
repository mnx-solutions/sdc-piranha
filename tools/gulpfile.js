'use strict';
var gulp = require('gulp');
var uncss = require('gulp-uncss');
var csscomb = require('gulp-csscomb');
var fs = require('fs');
var htmlparser = require("htmlparser2");

var rootFolder = '../site';
var htmls = [];
var ignoreClass = [/select2/];

var getAllFilesFromFolder = function (dir) {
    var results = [];
    fs.readdirSync(dir).forEach(function (file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFilesFromFolder(file));
        } else {
            results.push(file);
        }

    });
    return results;
};

function dataLoaded(err, data) {
    var parser = new htmlparser.Parser({
        onopentag: function (name, attribs) {
            if (attribs['data-ng-class']) {
                attribs['data-ng-class'].split(',').forEach(function (d) {
                    var className = d.split(':')[0].replace(/\'|\"|\{/g, "");
                    className = className.replace(/\s/g, "");
                    try {
                        var regex = new RegExp(className);
                        ignoreClass.push(regex);
                    } catch (e) {
//                        console.log(className);
                    }
                });
            }
        }
    });
    parser.write(data);
    parser.end();
}

getAllFilesFromFolder(rootFolder).forEach(function (file) {
    if (file.match(/\.html/)) {
        htmls.push('./' + file.toString());
        fs.readFile(file, 'utf8', dataLoaded);
    }
});

gulp.task('uncss', ['modules'], function () {
    return gulp.src('./../site/apps/**/*.css')
        .pipe(uncss({
            ignore : ignoreClass,
            html: htmls,
            timeout: 5000
        }))
        .pipe(csscomb())
        .pipe(gulp.dest('./../out/apps/'));
});

gulp.task('modules', ['static'], function () {
    return gulp.src('./../site/modules/**/*.css')
        .pipe(uncss({
            ignore : ignoreClass,
            html: htmls,
            timeout: 5000
        }))
        .pipe(csscomb())
        .pipe(gulp.dest('./../out/modules/'));
});

gulp.task('static', function () {
    return gulp.src('./../site/static/css/*.css')
        .pipe(uncss({
            ignore : ignoreClass,
            html: htmls,
            timeout: 5000
        }))
        .pipe(csscomb())
        .pipe(gulp.dest('./../out/static/css/'));
});