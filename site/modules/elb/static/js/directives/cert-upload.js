'use strict';

(function (app) {
    app.directive('certUpload', function () {
        return {
            template: '<input class="certUpload" accept="application/x-pem-file" type="file">',
            restrict: 'E',
            scope: {
                model: '='
            },
            link: function (scope, element, attrs) {
                $('.certUpload').change(function () {
                    alert('changed');
                });
            }
        };
    });
}(window.JP.getModule('elb')));


