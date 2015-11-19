'use strict';

(function (app) {app.directive('filemanUpload', ['PopupDialog', 'http', 'fileman', '$cacheFactory',
    function (PopupDialog, http, fileman, $cacheFactory) {
        var cache = $cacheFactory('filemanUploads');
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
                    var emitter = scope.$new(true);
                    http.uploadFiles('storage/upload', scope.filemanUpload, files, formId, function (error, data) {
                        if (error || data.status === 'error') {
                            var errorMessage = data && data.message || error && error.message || error;
                            var message = 'None of your active roles are present on the resource';
                            if (errorMessage && errorMessage.indexOf(message) !== -1) {
                                errorMessage = message + ' \'~~' + data.path + '\'.';
                            }
                            PopupDialog.error(null, errorMessage);
                            emitter.$emit(fileman.UPLOAD_EVENTS.error, data.id, data.path);
                            cache.remove(data.path + '/' + data.name);
                        } else if (data.status === 'uploadWaiting') {
                            emitter.$emit(fileman.UPLOAD_EVENTS.waiting, data.progress);
                        } else if (data.status === 'progress') {
                            data.progress.formId = formId;
                            emitter.$emit(fileman.UPLOAD_EVENTS.progress, data);
                        } else if (data.status === 'success') {
                            emitter.$emit(fileman.UPLOAD_EVENTS.ready, data.id, true, data.path);
                            emitter.$on(fileman.UPLOAD_EVENTS.complete, function (event, data) {
                                data.names.forEach(function (name) {
                                    cache.remove(data.progress.path + '/' + name);
                                });
                            });
                        }
                    });
                    return emitter;
                }

                var displayPopupIfFilesInProgress = function (files) {
                    if (files.length === 0) {
                        return;
                    }

                    PopupDialog.message('Files already in progress:', files.join(', '));
                };

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
                        var uploadPath = scope.$parent.uploadPath;
                        var filesInProgress = [];
                        files = files.filter(function (file) {
                            var fullPath = uploadPath + '/' + file.name;
                            if (!cache.get(fullPath)) {
                                cache.put(fullPath, true);
                                file.fullPath = fullPath;
                                return true;
                            }
                            filesInProgress.push(file.name);
                        });
                        var emitter = uploadFiles(files);
                        e.target.value = '';
                        scope.$parent.$emit(fileman.UPLOAD_EVENTS.start, emitter, files);
                        displayPopupIfFilesInProgress(filesInProgress);
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
