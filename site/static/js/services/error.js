'use strict';

(function (ng, app) {
    app.service(
        'errorContext',
        [ '$rootScope',
            function ($rootScope) {
                var errContext = {
                    active: false,
                    err: null
                };

                return {
                    emit: function (err, scope) {
                        if (err) {
                            errContext.active = true;
                            errContext.scope = scope || null;
                            errContext.err = err;
                            $rootScope.$broadcast('errorContextChanged', errContext);
                        }
                    },

                    clear: function () {
                        errContext.active = true;
                        errContext.scope = null;
                        errContext.err = null;
                    },

                    isActive: function () {
                        return errContext.active;
                    },

                    getContext: function () {
                        return errContext;
                    }
                }
            }
        ]);

}(window.angular, window.JP.main));