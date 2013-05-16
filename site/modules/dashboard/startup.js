'use strict';

var https = require('https');
var config = require('easy-config');
var restify = require('restify');

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    var cacheTTL = config.zendesk.cacheTTL || 1000 * 60 * 60;
    var cache = {};

    var client = restify.createJsonClient({
        url: config.zendesk.host,
        auth: config.zendesk.account + ':' + config.zendesk.token
    });


    function zendDeskCall(call, path, objectName) {
        if (cache[path] && ((Date.now() - cache[path].lastSuccess) < cacheTTL)) {
            call.log.debug("Returning Zendesk " + objectName + " from cache ");
            call.done(null, cache[path].data);
        } else {
            call.log.info('Querying Zendesk for ' + objectName + ' list');

            client.get(path, function (err, req, res, obj) {
                if (!err) {
                    // update cache
                    cache[path] = {};
                    cache[path].data = obj[objectName]
                    cache[path].lastSuccess = Date.now();

                    call.done(null, obj[objectName]);
                } else {
                    call.log.error(err);
                    call.done(err);
                }
            });
        }
    }

    server.onCall('ZendeskForumList', function (call) {
        zendDeskCall(call, config.zendesk.forumsPath, 'forums');
    });

    server.onCall('ZendeskSystemStatusTopics', function (call) {
        zendDeskCall(call, config.zendesk.systemStatusPath, 'topics');
    });

    server.onCall('ZendeskPackagesUpdateTopics', function (call) {
        zendDeskCall(call, config.zendesk.packageUpdatePath, 'topics');
    });

    setImmediate(callback);
};
