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
                //FIXME: Seriously?? We have to support IE7 and up. This will only work in 10+
                function uploadCertificate(file) {
                    var data = new FormData(), xhr = new XMLHttpRequest();
                    xhr.onerror = function () {
                        scope.$apply(function () {
                            notification.replace('elb', { type: 'error' }, 'Error while uploading certificate');
                        });
                    };
                    xhr.onload = function () {
                        scope.$apply(function () {
                            if (xhr.status === 200) {
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

                //FIXME: Do not mix jquery randomly - use angular
                $('.certUpload').change(function (e) {
                    if (e.target.files && e.target.files.length) {
                        uploadCertificate(e.target.files[0]);
                    }
                });
                //FIXME: Do not mix jquery randomly - use angular
                scope.upload = function () {
                    $('.certUpload').click();
                    $('.btn-joyent-blue').blur();
                };
                //FIXME: Do not mix jquery randomly - use angular
                scope.remove = function () {
                    $('.certUpload').val('');
                    // Can't set null certificate in ELBAPI, using empty GUID as empty/not-set certificate
                    scope.model = '00000000-0000-0000-0000-000000000000';
                };
            }
        };
    }]);
}(window.JP.getModule('elb')));


