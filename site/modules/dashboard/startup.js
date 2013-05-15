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

    function zendDeskCall(call, path, objectName) {
        call.log.info('Querying Zendesk for forums list');

        var options = {
            hostname: 'help.joyent.com',
            path: path,
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
                console.log(JSONbody);
                call.done(null, JSONbody[objectName]);
                return;
            });

        });
        req.on('error', function(e) {
            console.error(e);
        });
        req.end();
    }

    server.onCall('ZendeskForumList', function (call) {
        zendDeskCall(call, '/api/v2/categories/20066858/forums.json', 'forums');
    });

    server.onCall('ZendeskSystemStatusTopics', function(call) {
        zendDeskCall(call, '/api/v2/forums/20715782/topics.json', 'topics');
    })

    server.onCall('ZendeskPackagesUpdateTopics', function(call) {
        zendDeskCall(call, '/api/v2/forums/21147498/topics.json', 'topics');
    })

    setImmediate(callback);
};
