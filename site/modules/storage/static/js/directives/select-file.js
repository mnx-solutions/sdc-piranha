'use strict';

(function (app) {
    app.directive('selectFile', ['PopupDialog', 'localization', 'Account', 'fileman', function (PopupDialog, localization, Account, fileman) {
        return {
            restrict: 'EA',
            scope: {
                objects: '=',
                loading: '=?'
            },
            link: function (scope, element) {
                scope.objects = Array.isArray(scope.objects) ? scope.objects : [];

                element.bind('click', function () {
                    scope.newFilePath();
                });

                var addFilePathCtrl = function ($scope, dialog) {
                    $scope.$watch('filePath', function (filePath) {
                        Account.getParentAccount().then(function (parentAccount) {
                            $scope.fullFilePath = '/' + parentAccount.login + '/' + filePath.replace(/^\//, '');
                        });
                    });
                    $scope.close = function (form, res) {
                        $scope.formSubmitted = true;
                        if (form.$invalid && res !== 'cancel') {
                            return;
                        }
                        if (res === 'cancel') {
                            dialog.close({
                                value: res
                            });
                            return;
                        }
                        dialog.close({
                            value: 'add',
                            filePath: $scope.fullFilePath,
                            useMfind: $scope.useMfind,
                            mfind: $scope.mfind
                        });
                    };
                    $scope.filePath = '';
                    $scope.title = 'Specify file path';
                    $scope.buttons = [
                        {
                            result: 'cancel',
                            label: 'Cancel',
                            cssClass: 'btn grey-new effect-orange-button',
                            setFocus: false
                        },
                        {
                            result: 'add',
                            label: 'Add',
                            cssClass: 'btn orange',
                            setFocus: true
                        }
                    ];
                };

                function showPopupDialog(level, title, message, callback) {
                    return PopupDialog[level](
                        title ? localization.translate(scope, null, title) : null,
                        message ? localization.translate(scope, null, message) : null,
                        callback
                    );
                }

                function pushUnique(objects, path) {
                    var isUnique = !objects.some(function (e) { return e.filePath === path; });
                    if (isUnique) {
                        objects.push({
                            filePath: path,
                            create_at: new Date()
                        });
                    }
                }

                function getFiles(promise) {
                    var files = promise.__read();

                    if (files.length > 0) {
                        files.forEach(function (file) {
                            if (file.type !== 'directory') {
                                var path = file.parent + '/' + file.path;
                                pushUnique(scope.objects, path);
                            }
                        });
                    } else {
                        showPopupDialog('message', 'Message', 'Nothing found with your criteria.');
                    }

                    return files;
                }

                scope.loading = false;

                scope.newFilePath = function () {
                    var opts = {
                        templateUrl: 'storage/static/partials/add.html',
                        openCtrl: addFilePathCtrl
                    };

                    PopupDialog.custom(
                        opts,
                        function (result) {
                            if (result && result.value === 'add') {
                                scope.loading = true;
                                var filePath = result.filePath;

                                if (result.useMfind) {
                                    fileman.mfind(filePath, {mfind: result.mfind}, function (error, files) {
                                        scope.loading = false;
                                        
                                        if (error) {
                                            var errorMessage = 'None of your active roles are present on the resource';
                                            if (new RegExp(errorMessage).test(error)) {
                                                return showPopupDialog('error', 'Error', error);
                                            }
                                            if (error.code === "ForbiddenError") {
                                                return showPopupDialog('error', 'Error', errorMessage + filePath + '.');
                                            }
                                            return showPopupDialog('error', 'Error', 'An error occurred.');
                                        }
                                        return getFiles(files);
                                    });
                                } else {
                                    fileman.infoAbsolute(filePath, function (error, info) {
                                        scope.loading = false;
                                        if (error) {
                                            return showPopupDialog('error', 'Error', error);
                                        }
                                        var filePathInfo = info.__read();
                                        if (filePathInfo.extension === 'directory') {
                                            fileman.lsAbsolute(filePath, function (err, ls) {
                                                if (err) {
                                                    return showPopupDialog('error', 'Error', err);
                                                }
                                                return getFiles(ls);
                                            });
                                        } else {
                                            pushUnique(scope.objects, filePath);
                                        }
                                        return filePath;
                                    });
                                }
                            }
                        }
                    );
                };
            }
        };
    }]);
}(window.JP.getModule('Storage')));
