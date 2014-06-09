'use strict';

(function (app) {
    app.directive('builderGrid', ['PopupDialog', 'localization', 'Account', 'fileman', function (PopupDialog, localization, Account, fileman) {
        return {
            restrict: 'EA',
            scope: {
                objects: '='
            },

            link: function (scope) {
                var addFilePathCtrl = function ($scope, dialog) {
                    $scope.$watch('filePath', function (filePath) {
                        Account.getAccount().then(function (account) {
                            $scope.fullFilePath = '/' + account.login + filePath;
                        });
                    });
                    $scope.close = function (form, res) {
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
                            filePath: $scope.fullFilePath
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

                scope.newFilePath = function () {
                    var opts = {
                        templateUrl: 'storage/static/partials/add.html',
                        openCtrl: addFilePathCtrl
                    };

                    PopupDialog.custom(
                        opts,
                        function (result) {
                            if (result && result.value === 'add') {
                                var filePath = result.filePath;
                                fileman.infoAbsolute(filePath, function (error, info) {
                                    if (error) {
                                        return showPopupDialog('error', 'Error', error);
                                    }
                                    var filePathInfo = info.__read();
                                    if (filePathInfo.extension === 'directory') {
                                        fileman.lsAbsolute(filePath, function (err, ls) {
                                            if (err) {
                                               return showPopupDialog('error', 'Error', err);
                                            }
                                            var files = ls.__read();
                                            files.forEach(function (file) {
                                               if (file.type !== 'directory') {
                                                   var path = file.parent + '/' + file.path;
                                                   pushUnique(scope.objects, path);
                                               }
                                            });
                                            return files;
                                        });
                                    } else {
                                        pushUnique(scope.objects, filePath);
                                    }
                                    return filePath;
                                });
                            }
                        }
                    );
                };

                var gridMessages = {
                    delete: {
                        single: 'Delete this record ?',
                        plural: 'Delete selected records ?'
                    }
                };

                scope.gridOrder = [];
                scope.gridProps = [
                    {
                        id: 'filePath',
                        name: 'File Path',
                        sequence: 1,
                        active: true
                    }
                ];
                scope.gridActionButtons = [
                    {
                        label: 'Delete',
                        action: function () {
                            deleteRecord(gridMessages.delete);
                        },
                        sequence: 1
                    }
                ];


                scope.exportFields = {
                    ignore: 'all'
                };

                scope.searchForm = true;
                scope.enabledCheckboxes = true;
                scope.placeHolderText = 'filter';

                var noCheckBoxChecked = function () {
                    showPopupDialog('error', 'Error', 'No item selected for the action.');
                };

                scope.getCheckedItems = function (obj) {
                    return obj.filter(function (el) {
                        return el.checked;
                    });
                };

                var deleteRecord = function (messageBody) {
                    var checkedArray = scope.getCheckedItems(scope.objects);

                    if (checkedArray.length) {
                        PopupDialog.confirm(
                            localization.translate(
                                scope,
                                null,
                                'Confirm: Delete record'
                            ),
                            localization.translate(
                                scope,
                                null,
                                (function () {
                                    var result = messageBody.single;
                                    if (checkedArray.length > 1) {
                                        result = messageBody.plural;
                                    }
                                    return result;
                                }())
                            ), function () {
                                scope.objects = scope.objects.filter(function (el) {
                                    return !el.checked;
                                });
                            }
                        );
                    } else {
                        noCheckBoxChecked();
                    }
                };
            },

            templateUrl: 'storage/static/partials/builder-grid.html'
        };
    }]);
}(window.JP.getModule('Storage')));