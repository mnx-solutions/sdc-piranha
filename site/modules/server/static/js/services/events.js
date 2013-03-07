'use strict';

(function (app) {
    // I provide information about the current route request.
    app.factory('Events', ["$http","$rootScope","$timeout", function ($http, $rootScope, $timeout) {

        (function () {
            $timeout(function myFunction() {
                console.log("polling events");
                $http.get('/events').success(function (data) {
                    data.forEach(function(event){
                        console.log("emmiting", event);
                        $rootScope.emit(event.event, event.data);
                    });
                });
                $timeout(myFunction, 1000);
            }, 1000);
        })();

        return {
            send: function (message, data) {
                $http.post('/events', [
                    {event: message, data: data}
                ]);
            },
            on: function (message, callback) {
                console.log("listener registered on", message)
                $rootScope.on(message, callback);
            }
        };
    }]);
}(window.JP.getModule('Server')));
