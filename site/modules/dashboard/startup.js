'use strict';

var https = require('https');
var config = require('easy-config');

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    var langs = {};
    var oldLangs = {};
    scope.config.localization.locales.forEach(function (lng) {
        langs[lng] = {};
    });

    server.onCall('ZendeskForumList', function (call) {
        call.log.info('Querying Zendesk for forums list');

        var options = {
            hostname: 'help.joyent.com',
            path: '/api/v2/categories/20066858/forums.json',
            method: 'GET',
            auth: config.zendesk.account + ':' + config.zendesk.token
        };
        var body = '';
        var req = https.request(options,  function(res) {

            res.on('data', function(chunk) {
                body += chunk;
            });

            res.on('end', function(){
                var JSONbody = JSON.parse(body);
                call.done(null, JSONbody['forums']);
                return;
            });

        });
        req.on('error', function(e) {
            console.error(e);
        });
        req.end();

    });

    setImmediate(callback);
};
