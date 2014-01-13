'use strict';

// as we are doing our own exceptionHandling, let's overwrite angular
window.JP.main.factory('$exceptionHandler',
    ['$log', 'loggingService',
        function ($log, loggingService) {
            return function (exception, cause) {

                // default logging behavior, keep it, so client wouldn't notice anything
                $log.error(exception);

                // make our magic happen
                loggingService.logUncaught(exception);
            };
        }
    ]
);