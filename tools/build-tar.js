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
var productionImage = 'Image    base64 13.1.0';

// must point to piranha root
var dirFix = 'cd '+ __dirname +'/../ ';

var noTagCheck = false;
var noPackageCheck = false;

// options
process.argv.forEach(function(val, index, array) {
    if(val === '-skiptags') {
        noTagCheck = true;
    }

    if(val === '-skippackage') {
        noPackageCheck = true;
    }

    if(val === '-help' || val === '--help' || val === '-h' || val === '--h') {
        console.log('Tar builder for piranha');
        console.log('');
        console.log('-skiptags          Skip git tag / branch checking');
        console.log('-skippackage       Skip smartmachine package check');
        process.exit(0);
    }
});


/**
 * Will get the latest tag made from git using git tag (bottom one is the latest)
 *
 * @param next
 */
var getLatestTag = function getLatestTag(next) {
    // get latest tag
    exec(dirFix +'&& echo -n "$(git tag | tail -1)"', function(err, stdout, stderr) {
        if(err || stderr) {
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
    if(noTagCheck) {
        next();
        return;
    }

    exec(dirFix +'&& BRANCH=$(git describe --all); echo -n "$BRANCH"', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if(stdout != 'tags/'+ latestTag) {
            console.log(errorc +'Wrong git branch. Please run: '+ codec +'git checkout tags/'+ latestTag);
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
    if(noTagCheck) {
        next();
        return;
    }
    exec(dirFix +'&& test "'+ latestTag +'" == "$(git describe --always --tags)" && echo -n True || echo -n false', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if(stdout == 'false') {
            console.log(errorc +'Wrong tag. Please run: '+ codec +'git checkout tags/'+ latestTag);
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
    if(noPackageCheck) {
        next();
        return;
    }

    exec(dirFix +'&& sm-summary 2> /dev/null | grep $"^Image\t*"', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log(codec +'sm-summary'+ errorc +' command not found. Are you on a smartmachine? Use -skippackage to ignore this error');
            process.exit(1);
        }

        if(stdout != productionImage) {
            console.log(errorc +'Current machine has wrong image. Please provision SmartMachine machine with image'+ codec +' '+ productionImage);
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

    var installer = exec(dirFix +'&& npm install --force', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        next();
    });

    var installTimeout = setTimeout(function() {
        console.log(errorc +'npm install took too long. Exited after 3 minutes');
        installer.kill('SIGKILL');
        process.exit(1);
    }, 3*60*1000)
};

/**
 * Uses npm list to check if everything checks out.
 *
 * @param next
 */
var checkModules = function checkModules(next) {

    // check if all modules are there
    exec(dirFix +'&& npm list 2>&1 | grep "not ok"', function(err, stdout, stderr) {
        if(err || stderr) {
            console.log(err, stderr);
            process.exit(1);
        }

        if(stdout) {
            console.log(errorc +'modules check failed. Please see'+ codec +' npm list '+ errorc +'for more information');
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
    console.log(successc +'Making tar...');

    var tarName = 'portal-'+ latestTag +'.tar';
    exec(dirFix +'&& tar -cvf '+ tarName +' -X .gitignore . &&  tar -uvf '+ tarName +' ./site/config/config.blacklist.json && gzip -f  '+ tarName, function(err, stdout, stderr) {
        if(err || stderr) {
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
var getNext = function() {
    if(test >= checks.length) {
        console.log(clearFormatting +'exiting');
        process.exit(0);
    }
    test++;
    return function() { checks[test](getNext()) };
};

// run tests
checks[test](getNext());