'use strict';


(function (app) {

    app.factory('ca', ['caBackend', function (caBackend) {

        var ca = {
            conf:'',
            panel:''
        };


        return ca;
    }]);

}(window.JP.getModule('cloudAnalytics')));
