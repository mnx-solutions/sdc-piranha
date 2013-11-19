'use strict';

(function (app) {
    app.directive('certUpload', ['notification', '$dialog', function (notification, $dialog) {
        return {
            templateUrl: 'elb/static/templates/cert-upload.html',
            restrict: 'EA',
            scope: {
                model: '='
            },
            link: function (scope, element, attrs) {
                var uploadForm = document.getElementById('certificate_upload_form');
                var uploadFile = document.getElementById('certificate_upload_file');
                var uploadBtn = document.getElementById('certificate_upload_btn');
                var uploadPass = document.getElementById('certificate_upload_passphrase');

                function passwordPrompt(callback) {
                    var title = 'Specify passphrase';
                    var templateUrl = 'elb/static/templates/cert-upload-passphrase.html';
                    $dialog.messageBox(title, '', [], templateUrl)
                        .open()
                        .then(callback);
                }

                window.__uploadCallback__ = function (data) {
                    scope.$apply(function () {
                        if (data.success) {
                            notification.replace('elb', { type: 'success' }, 'Certificate added');
                            scope.model = data.id;
                        } else if (data.passphrase) {
                            passwordPrompt(function (passphrase) {
                                if (!passphrase) {
                                    uploadFile.value = '';
                                    return;
                                }
                                uploadPass.value = passphrase;
                                uploadForm.submit();
                            });
                        } else {
                            notification.replace('elb', { type: 'error' }, data.message);
                        }
                    });
                };

                uploadFile.onchange = function uploadFileChange(e) {
                    if (e.target.value || (e.target.files && e.target.files.length)) {
                        uploadPass.value = '';
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


