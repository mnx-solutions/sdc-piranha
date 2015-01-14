'use strict';

(function (app) {
    app.directive('certUpload', ['PopupDialog', 'localization', function (PopupDialog, localization) {
        return {
            templateUrl: 'slb/static/templates/cert-upload.html',
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
                    var opts = {
                        title: 'Specify passphrase',
                        templateUrl: 'slb/static/templates/cert-upload-passphrase.html'
                    };
                    PopupDialog.custom(opts, callback);
                }

                window.__uploadCallback__ = function (data) {
                    scope.$apply(function () {
                        if (data.success) {
                            PopupDialog.message(
                                localization.translate(
                                    null,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    null,
                                    'slb',
                                    'Certificate added.'
                                ),
                                function () {}
                            );
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
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'slb',
                                    data.message
                                )
                            );
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
                    // Can't set null certificate in SLBAPI, using empty GUID as empty/not-set certificate
                    scope.model = '00000000-0000-0000-0000-000000000000';
                };
            }
        };
    }]);
}(window.JP.getModule('slb')));
