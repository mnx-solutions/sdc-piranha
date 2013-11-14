'use strict';

var exec = require('child_process').exec;

var git = {
    commitId: null,
    branch: null,
    description: null
}

exec('git rev-parse --abbrev-ref HEAD', function (error, stdout) {
    if (stdout && typeof stdout === 'string') {
        git.branch = stdout.split("\n")[0];
    }
});

exec('git rev-parse HEAD', function (error, stdout) {
    if (stdout && typeof stdout === 'string') {
        git.commitId = stdout.split("\n")[0];
    }
});

exec('git describe', function (error, stdout) {
    if (stdout && typeof stdout === 'string') {
        git.description = stdout.split("\n")[0];
    }
});

module.exports = function getGitInfo(callback) {
    if (!git.commitId || !git.branch || !git.description) {
        callback('Error getting git information');
    } else {
        callback(null, git);
    }
};
