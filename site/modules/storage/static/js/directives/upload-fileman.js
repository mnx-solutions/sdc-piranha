'use strict';

(function (app) {
    app.directive('filemanUpload', ['PopupDialog', 'http', function (PopupDialog, http) {
        return {
            restrict: 'EA',
            scope: {
                model: '=',
                filemanUpload: '=',
                existingFiles: '='
            },
            link: function (scope, element) {

                function uploadFiles(files) {
                    var formId = window.uuid.v4();
                    http.uploadFiles('storage/upload', scope.filemanUpload, files, formId, function (error, data) {
                        scope.$apply(function () {
                            if (error || data.status === 'error') {
                                var errorMessage = data && data.message || error && error.message || error;
                                var message = 'None of your active roles are present on the resource';
                                if (errorMessage && errorMessage.indexOf(message) !== -1) {
                                    errorMessage = message + ' \'~~' + data.path + '\'.';
                                }
                                PopupDialog.error(null, errorMessage);
                                scope.$parent.$emit('uploadError', data.id, data.path);
                            } else if (data.status === 'uploadWaiting') {
                                scope.$parent.$emit('uploadWaiting', data.progress);
                            } else if (data.status === 'progress') {
                                data.progress.formId = formId;
                                scope.$parent.$emit('uploadProgress', data.progress, data.progress.path);
                            } else if (data.status === 'success') {
                                scope.$parent.$emit('uploadReady', data.id, true, data.path);
                            }
                        });
                    });
                }

                element.change(function (e) {
                    var selectedFilesArr = [].slice.call(e.target.files);
                    var noExistingFiles = selectedFilesArr;
                    var selectedFileNames = selectedFilesArr.map(function (file) { return file.name; });
                    var existingFiles = [];
                    var existingFolders = [];
                    scope.existingFiles.forEach(function (file) {
                        if (selectedFileNames.indexOf(file.path) !== -1) {
                            if (file.type === 'directory') {
                                existingFolders.push(file.path);
                            } else {
                                existingFiles.push(file.path);
                            }
                            noExistingFiles = noExistingFiles.filter(function (el) { return el.name !== file.path; });
                        }
                    });

                    var finalUpload = function (files) {
                        files = files || selectedFilesArr;
                        uploadFiles(files);
                        e.target.value = '';
                        scope.$parent.$emit('uploadStart', true);
                    };
                    if (existingFolders.length > 0) {
                        e.target.value = '';
                        return PopupDialog.message(
                            'Message',
                            'Folder named ' + existingFolders.join(', ') + ' already exists.'
                        );
                    }
                    scope.$apply(function () {
                        if (existingFiles.length > 0) {
                            var message = 'Are you sure you want to overwrite ' + existingFiles.join(', ') + '?';
                            return PopupDialog.confirm(
                                'Confirm: Add files',
                                message,
                                function () {
                                    finalUpload();
                                },
                                function () {
                                    if (noExistingFiles.length) {
                                        finalUpload(noExistingFiles);
                                    } else {
                                        e.target.value = '';
                                    }
                                });
                        } else {
                            return finalUpload();
                        }
                    });
                });
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('Storage')));
