'use strict';

(function (app, ng) {
    app.directive('filemanUpload', [ function () {
        return {
            restrict: 'EA',
            scope: {
                model: '=',
                filemanUpload: '='
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
                    if (e.target.files && e.target.files.length) {
                        uploadFiles(e.target.files);
                        e.target.value = '';
                        scope.$parent.$emit('uploadStart', true);
                    }
                });
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('fileman'), angular));


