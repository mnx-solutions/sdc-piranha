'use strict';

(function (app) {
    app.directive('filemanUpload', ['PopupDialog', 'http', 'notification', function (PopupDialog, http, notification) {
        return {
            restrict: 'EA',
            scope: {
                model: '=',
                filemanUpload: '=',
                existingFiles: '='
            },
            link: function (scope, element) {
                var FILE_MANAGER_PATH = '/manta/files';

                function uploadFiles(files) {
                    http.uploadFiles('storage/upload', scope.filemanUpload, files, function (error, data) {
                        var isError = false;
                        var message;
                        if (error || data.status === 'error') {
                            isError = true;
                            message = data.message || (error.message || error);
                        } else {
                            var uploadedFiles = files.map(function (file) {
                                return '"' + file.name + '"';
                            }).join(', ');
                            message = 'File ' + uploadedFiles + ' was';
                            if (files.length > 1) {
                                message = 'Files ' + uploadedFiles + ' were';
                            }
                            message += ' successfully uploaded';
                        }
                        notification.popup(isError, isError, FILE_MANAGER_PATH, null, message);
                        scope.$parent.$emit('uploadReady', true, scope.filemanUpload);
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
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('Storage')));
