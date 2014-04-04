'use strict';

(function (app, ng) {
    app.directive('filemanUpload', ['PopupDialog', function (PopupDialog) {
        return {
            restrict: 'EA',
            scope: {
                model: '=',
                filemanUpload: '=',
                existingFiles: '='
            },
            link: function (scope, element, attrs) {
                function uploadFiles(files) {
                    var data = new FormData();
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        scope.$apply(function () {
                            if (xhr.status === 200) {
                                scope.$parent.$emit('uploadReady', true);
                                scope.model = JSON.parse(xhr.responseText).id;
                            }
                        });
                    };
                    for (var fileIndex = 0; fileIndex < files.length; fileIndex++) {
                        data.append('uploadInput', files[fileIndex]);
                    }
                    data.append('path', scope.filemanUpload);
                    xhr.open('POST', 'fileman/upload');
                    xhr.send(data);
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
