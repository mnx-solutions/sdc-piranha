'use strict';

(function (ng, app) {
    app.service(
        'ErrorService',
        [   'localization',
            function (localization) {
                var service = {errors: {}};

                service.getLastErrors = function (errorType, errorKey) {
                    var errors = service.errors;
                    if (errorType) {
                        errors = service.errors[errorType] = service.errors[errorType] || {};
                    }
                    return errorType && errorKey ? errors[errorKey] : errors;
                };

                service.setLastError = function (errorType, errorKey, message, scope) {
                    var errors = service.getLastErrors(errorType);
                    errors[errorKey] = localization.translate(null, 'error', message, scope);
               };

                service.flushErrors = function (errorType, errorKey) {
                    if (!errorType) {
                        service.errors = {};
                    } else if (!errorKey) {
                        delete service.errors[errorType];
                    } else if (service.errors[errorType]) {
                        delete service.errors[errorType][errorKey];
                    }
                };

                return service;
            }]
    );
}(window.angular, window.JP.getModule('error')));
