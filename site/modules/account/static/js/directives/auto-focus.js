'use strict';

(function (ng, app) {
    app.directive('autoFocus', [
        function () {
            return {
                restrict: 'A',
                link: function(scope, element) {
                    var INTERVAL = 500; // ms
                    var TIMEOUT = 6000; // ms
                    var counter = 0;
                    function setFocus() {
                        element[0].focus();
                    }
                    var doFocus = setInterval(function () {
                        setFocus();
                        if (counter >= TIMEOUT || ng.element(element[0]).is(':focus')) {
                            clearInterval(doFocus);
                        }
                        counter += INTERVAL;
                    }, INTERVAL);
                }
            };
        }]);
}(window.angular, window.JP.getModule('Account')));