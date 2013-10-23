/* Makes it easy to run SDC cli stuff */
var config = require('easy-config').loadConfig({path: __dirname +'/config'});
var exec = require('child_process').exec;
var logPrefix = 'runsdc: ';

if(!config.cloudapi || !config.cloudapi.username || !config.cloudapi.keyId || !config.cloudapi.url) {
    console.log(logPrefix +'Config missing. Make sure your environment config is correct');
    process.exit(1);
}


// set environment vairables needed for SDC cli
process.env['SDC_TESTING'] = 1;
process.env['SDC_ACCOUNT'] = config.cloudapi.username;
process.env['SDC_KEY_ID'] = config.cloudapi.keyId;
process.env['SDC_URL'] = config.cloudapi.url;


// build user command and run it
var command = '';
process.argv.forEach(function(val, index, array) {

    if(command !== '' || val.match('.*sdc-.*')) {
        command += val +' ';
    }

    if(index == array.length-1) {
        console.log(logPrefix +'Running user command "', command, '"');
        exec("cd "+ __dirname +"/../node_modules/smartdc/bin/ && "+ command, function(err, stdout, stderr) {
            if(err) {
                console.log(logPrefix +'Unable to run given command');
                console.log(err.message);
                process.exit(1);
            }
            console.log(stdout, stderr);
            process.exit(0);
        });
    }
});
