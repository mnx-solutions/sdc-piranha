'use strict';

(function (app) {
    app.directive('certUpload', ['notification', function (notification) {
        return {
            templateUrl: 'elb/static/partials/cert-upload.html',
            restrict: 'E',
            scope: {
                model: '='
            },
            link: function (scope, element, attrs) {
                $('.certUpload').change(function () {
                    uploadCertificate(event.target.files[0]);
                });
                scope.uploadClick = function () {
                    $('.certUpload').click();
                }

                function uploadCertificate(file) {
                    var data = new FormData(), xhr = new XMLHttpRequest();
                    xhr.onloadstart = function (e) {
                        // start
                    };
                    xhr.onerror = function (e) {
                        // error
                    };
                    xhr.onload = function (e) {
                        console.log(xhr.responseText);
                    };
                    data.append('certificate', file, file.name);
                    xhr.open('POST', '/main/elb/certificates');
                    xhr.send(data);
                }
            }
        };
    }]);
}(window.JP.getModule('elb')));


