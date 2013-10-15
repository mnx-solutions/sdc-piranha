'use strict';

(function (app) {
    app.directive('certUpload', ['notification', function (notification) {
        return {
            templateUrl: 'elb/static/partials/cert-upload.html',
            restrict: 'EA',
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
                    xhr.onerror = function (e) {
                        scope.$apply(function () {
                            notification.replace('elb', { type: 'error' }, 'Error while uploading certificate');
                        });
                    };
                    xhr.onload = function (e) {
                        scope.$apply(function () {
                            if (xhr.status == 200) {
                                notification.replace('elb', { type: 'success' }, 'Certificate added');
                                scope.model = JSON.parse(xhr.responseText).id;
                            } else {
                                notification.replace('elb', { type: 'error' }, xhr.responseText);
                            }
                        });
                    };
                    data.append('certificate', file, file.name);
                    xhr.open('POST', '/main/elb/certificates');
                    xhr.send(data);
                }
            }
        };
    }]);
}(window.JP.getModule('elb')));


