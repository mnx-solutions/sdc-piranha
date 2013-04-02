'use strict';


(function (ng, app) {

    // give reference of internals for debuggin purposes
    app.factory('serverCallInternals', ['serverTab', function (serverTab) {
        return function () {
            return {calls: serverTab.call(), history: serverTab.history()};
        };
    }]);

}(window.angular, window.JP.getModule('Server')));
