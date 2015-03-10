'use strict';

(function (ng, app) {
    app.directive('datepicker', ['$rootScope', '$filter', function ($rootScope, $filter) {
        return {
            scope: {
                date: '='
            },
            link: function (scope, el) {
                function setDatepickerDate() {
                    var shortDate = $filter('date')(scope.date, 'yyyy/MM/dd');
                    $(el).datepicker("setDate", shortDate);
                }
                $(el).datepicker({
                    autoclose: true,
                    format: 'yyyy/MM/dd',
                    orientation: 'top left'
                }).on('changeDate', function (ev) {
                    if (!ev.date || scope.date === new Date(ev.date)) {
                        setDatepickerDate();
                        return;
                    }
                    if(!$rootScope.$$phase) {
                        scope.$apply(function () {
                            scope.date = new Date(ev.date);
                        });
                    } else {
                        scope.date = new Date(ev.date);
                    }
                }).on('show', function (ev) {
                    if ($(el).attr('toggled') === 'open') {
                        $(el).datepicker('hide');
                    } else {
                        $(el).attr('toggled', 'open');
                    }
                }).on('hide', function (ev) {
                    $(el).attr('toggled', 'close');
                });
                setDatepickerDate();
            }
        };
    }]);
}(window.angular, window.JP.getModule('docker')));