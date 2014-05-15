'use strict';

(function (app, ng) {
    app.directive('filemanUpload', ['PopupDialog', 'http', function (PopupDialog, http) {
        return {
            restrict: 'EA',
            scope: {
                model: '=',
                filemanUpload: '=',
                existingFiles: '='
            },
            link: function (scope, element, attrs) {
                function uploadFiles(files) {
                    http.uploadFiles('storage/upload', scope.filemanUpload, files, function (error) {
                        if (error) {
                            PopupDialog.error(null, error);
                        }
                        scope.$parent.$emit('uploadReady', true, scope.filemanUpload);
                    });
                }

                element.change(function (e) {
                    var selectedFilesArr = [].slice.call(e.target.files);
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
                        }
                    });
                    var finalUpload = function () {
                        uploadFiles(selectedFilesArr);
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
                        PopupDialog.confirm(
                            'Confirm: Add files',
                            message,
                            function () {
                                finalUpload();
                            },
                            function () {
                                e.target.value = '';
                            });
                    } else {
                        finalUpload();
                    }
                });
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('Storage'), angular));
