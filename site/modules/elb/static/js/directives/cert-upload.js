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
                window.__uploadCallback__ = function (data) {
                    scope.$apply(function () {
                        if (data.success) {
                            notification.replace('elb', { type: 'success' }, 'Certificate added');
                            scope.model = data.id;
                        } else {
                            notification.replace('elb', { type: 'error' }, data.message);
                        }
                    });
                };

                var uploadForm = document.getElementById('certificate_upload_form');
                var uploadFile = document.getElementById('certificate_upload_file');
                var uploadBtn = document.getElementById('certificate_upload_btn');

                uploadFile.onchange = function uploadFileChange(e) {
                    if (e.target.value || (e.target.files && e.target.files.length)) {
                        uploadForm.submit();
                    }
                };

                scope.remove = function () {
                    uploadFile.value = '';
                    // Can't set null certificate in ELBAPI, using empty GUID as empty/not-set certificate
                    scope.model = '00000000-0000-0000-0000-000000000000';
                };
            }
        };
    }]);
}(window.JP.getModule('elb')));


