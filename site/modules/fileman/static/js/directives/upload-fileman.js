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
                    http.uploadFiles('fileman/upload', scope.filemanUpload, files, function (error, response) {
                        if (!error) {
                            scope.$parent.$emit('uploadReady', true);
                        }
                    });
                }

                element.change(function (e) {
                    var selectedFilesArr = [].slice.call(e.target.files);
                    var selectedFileNames = selectedFilesArr.map(function (file) { return file.name; });
                    var existingFileNames = scope.existingFiles.filter(function (file) { return file.type !== 'directory'; }).map(function (file) { return file.path; });
                    var finalUpload = function () {
                        uploadFiles(e.target.files);
                        e.target.value = '';
                        scope.$parent.$emit('uploadStart', true);
                    };
                    var intersectFiles = selectedFileNames.filter(function (name) { return existingFileNames.indexOf(name) !== -1; });
                    if (intersectFiles.length > 0) {
                        var message = 'Are you sure you want to overwrite ' + intersectFiles.join(', ') + ' ?';
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
                    };
                });
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('fileman'), angular));
