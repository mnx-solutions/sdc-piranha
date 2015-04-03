'use strict';

// Our loggingService for client -> server side logging
// Please note that we can not use AngularJS own $http here due to circular dependency
window.JP.main.factory(
    'loggingService',
    function () {
        var loggingService = {};

        /**
         * Main logging function. Sends log to server
         * All arguments given are passed for logging
         * @param level
         * @param msg
         */
        loggingService.log = function log(level, msg) {
            // allow usage of log('foo');
            if (!msg) {
                msg = level;

                // default logging level is debug, level is checked again on server-side
                level = 'debug';
            }

            // add some additional information about the user to the log
            var userInfo = {
                url: window.location.href,
                userAgent: window.navigator.userAgent,
                platform: window.navigator.platform
            };

            var postData = {
                level: level,
                message: msg,
                userInfo: userInfo,
                args: []
            };

            // if our function has any other args passed in, pass them to the server too
            if (arguments.length > 2) {
                for (var i = 2; i < arguments.length; i++) {
                    postData.args.push(arguments[i]);
                }
            }

            // do a post against server logging endpoint
            // we are using jQuery here instead of $http to avoid circular dependency errors
            // also this is authorized endpoint, so it is only possible to log error to server-side
            // beyond log-in point
            $.ajax({
                type: 'POST',
                url: './account/log/error',
                data: JSON.stringify(postData),
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                success: function (data) {}
            });
        };

        /**
         * This handles angularJS exception which is unhandled by our code
         * These exceptions are also printed to user console
         * @param exception
         */
        loggingService.logUncaught = function logUncaught(exception) {
            loggingService.log('debug', exception.message, exception.stack);
        };

        return loggingService;
    }
);
