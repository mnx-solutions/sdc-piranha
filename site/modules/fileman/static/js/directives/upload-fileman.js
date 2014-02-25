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
                function uploadFile(file) {
                    var data = new FormData();
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        scope.$apply(function () {
                            if (xhr.status === 200) {
                                scope.$parent.$emit('uploadready', true);
                                scope.model = JSON.parse(xhr.responseText).id;
                            }
                        });
                    };
                    data.append('uploadInput', file);
                    data.append('path', scope.filemanUpload);
                    xhr.open('POST', 'fileman/upload');
                    xhr.send(data);
                }

                element.change(function (e) {
                    if (e.target.files && e.target.files.length) {
                        uploadFile(e.target.files[0]);
                    }
                });
                scope.upload = function () {
                    element.click();
                };
            }
        };
    }]);
}(window.JP.getModule('fileman'), angular));


