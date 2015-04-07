/**
 * tarbuilder for piranha
 */
var fs = require('fs');
var exec = require('child_process').exec;
var os = require('os');

var errorc = '\033[1;31m';
var warningc = '\033[1;33m';
var codec = '\033[1;34m';
var clearFormatting = '\033[0m';
var successc = '\033[1;32m';

var latestTag = null;
var productionImage = 'Image               base64 13.1.0';

// must point to piranha root
var dirFix = 'cd ' + __dirname + '/../ ';

var noTagCheck = false;
var noPackageCheck = false;
var debug = '';

// options
process.argv.forEach(function (val, index, array) {
    if (val === '--skip-tags') {
        noTagCheck = true;
    }

    if (val === '--skip-package') {
        noPackageCheck = true;
    }

    if (val === '--in-root') {
        dirFix = 'cd ' + __dirname + '/';
    }

    if (val === '--debug') {
        debug = ' | tee -a "debug.log"';
    }

    if (val === '-help' || val === '--help' || val === '-h' || val === '--h') {
        console.log('Tar builder for piranha');
        console.log('');
        console.log('--skip-tags          Skip git tag / branch checking');
        console.log('--skip-package       Skip smartmachine package check');
        console.log('--in-root          Use this when build-tar is in piranha root');
        console.log('--debug            When this flag is present, debug.log is generated with output');
        process.exit(0);
    }
});

/**
 * Remove newlines and spaces from stdout
 */
function clean(stdout) {
    return stdout.replace(/(\r\n|\n|\r)/gm, '').trim();
}

/**
 * Will get the latest tag made from git using git tag (bottom one is the latest)
 *
 * @param next
 */
var getLatestTag = function getLatestTag(next) {
    // get latest tag
    exec(dirFix + '&& git tag | tail -1 ' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        latestTag = stdout;
        next();
    });
};

/**
 * Checks current branch. Using git describe --all instead of git branch.
 * Current branch must == to lastTag unless -skiptags flag is present
 *
 * @param next
 */
var checkCurrentBranch = function checkCurrentBranch(next) {
    if (noTagCheck) {
        next();
        return;
    }

    exec(dirFix + '&& git describe --all' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if (stdout != 'tags/' + latestTag) {
            console.log(errorc + 'Wrong git branch. Please run: ' + codec + 'git checkout tags/' + latestTag + clearFormatting);
            process.exit(1);
        }

        next();
    });
};

/**
 * Checks current tag using git describe --tags
 * Must == to lastTag unless -skiptags flag is present
 *
 * @param next
 */
var checkCurrentTag = function checkCurrentTag(next) {
    if (noTagCheck) {
        next();
        return;
    }
    exec(dirFix + '&& test "' + latestTag + '" == "$(git describe --always --tags)" && echo True || echo false' + debug, function(err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if (stdout == 'false') {
            console.log(errorc + 'Wrong tag. Please run: ' + codec + 'git checkout tags/' + latestTag + clearFormatting);
            process.exit(1);
        }

        next();
    });
};

/**
 * Checks if current machine has the correct image. Fails if image is not correct or sm-summary isn't present at all.
 * Skips with -skippackage flag
 *
 * @param next
 */
var checkPackage = function checkPackage(next) {
    if (noPackageCheck) {
        next();
        return;
    }

    exec(dirFix + '&& sm-summary 2> /dev/null | grep $"^Image\t*"' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(codec + 'sm-summary' + errorc + ' command not found. Are you on a smartmachine? Use -skippackage to ignore this error' + clearFormatting);
            process.exit(1);
        }

        if (stdout != productionImage) {
            console.log(errorc + 'Current machine has wrong image. Please provision SmartMachine machine with image' + codec + ' ' + productionImage + clearFormatting);
            process.exit(1);
        }

        next();
    });
};

/**
 * Makes an force npm install
 *
 * @param next
 */
var npmInstall = function npmInstall(next) {
    console.log(successc + 'Running ' + codec + 'npm install --force --production ' + successc + 'please wait' + clearFormatting);
    var installer = exec(dirFix + '&& rm -fr ' + dirFix.trim() + 'node_modules/ && npm install --force --production 2>&1 ' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        console.log(codec + 'npm install' + successc + ' finished');
        next();
    });

    var installTimeout = setTimeout(function () {
        console.log(errorc + 'npm install took too long. Exited after 3 minutes' + clearFormatting);
        installer.kill('SIGKILL');
        process.exit(1);
    }, 3 * 60 * 1000);
};

/**
 * Uses npm list to check if everything checks out.
 *
 * @param next
 */
var checkModules = function checkModules(next) {

    // check if all modules are there
    console.log(successc + 'Running ' + codec + 'npm list 2>&1 | grep "not ok"' + successc + ' please wait ' + clearFormatting);
    exec(dirFix + '&& npm list 2>&1 | tee -a "debug.log" | grep "not ok"' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if (stdout) {
            console.log(errorc + 'modules check failed. Please see' + codec + ' npm list ' + errorc + 'for more information' + clearFormatting);
            process.exit(1);
        }

        next();
    });

};

/**
 * tars directory using .gitignore as exclude list. Adds blacklist.json to the tars then gzips it.
 *
 * @param next
 */
var makeTar = function makeTar(next) {
    console.log(successc + 'Making tar...');

    var tarName = 'portal-' + latestTag + '.tar';
    exec(dirFix + '&& tar -cf ' + tarName + ' -X ./tools/.tarignore * &&  tar -uf ' + tarName +
        ' ./site/config/config.blacklist.json && gzip -f  ' + tarName + ' ' + debug, function (err, stdout, stderr) {
        stdout = clean(stdout);

        if (err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        console.log(successc + tarName);
        next();
    });
};

// full check list, in order.
var checks = [getLatestTag, checkCurrentBranch, checkCurrentTag, checkPackage, npmInstall, checkModules, makeTar];

var test = 0;
var getNext = function () {
    if (test >= checks.length) {
        console.log(clearFormatting + 'exiting');
        process.exit(0);
    }
    test++;
    return function() { checks[test](getNext()) };
};

// run tests
checks[test](getNext());
