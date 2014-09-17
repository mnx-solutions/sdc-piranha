'use strict';

(function (ng, app) {
    app.directive('datepicker', ['$rootScope', function ($rootScope) {
        return {
            scope: {
                date: '='
            },
            link: function (scope, el) {
                $(el).datepicker({
                    autoclose: true
                }).on('changeDate', function(ev){
                    if(!$rootScope.$$phase) {
                        scope.$apply(function () {
                            scope.date = new Date(ev.date);
                        });
                    } else {
                        scope.date = new Date(ev.date);
                    }

                });
                $(el).datepicker("setDate", scope.date);
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));