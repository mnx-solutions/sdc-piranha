'use strict';

(function (app) {
    app.directive('builderGrid', ['PopupDialog', 'localization', function (PopupDialog, localization) {
        return {
            restrict: 'EA',
            scope: {
                objects: '='
            },

            link: function ($scope) {
                var addFilePathCtrl = function ($scope, dialog) {
                    $scope.close = function (res) {
                        if (res === 'cancel') {
                            dialog.close({
                                value: res
                            });
                            return;
                        }
                        dialog.close({
                            value: 'add',
                            filePath: $scope.filePath
                        });
                    };
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

                $scope.newFilePath = function () {
                    var opts = {
                        templateUrl: 'storage/static/partials/add.html',
                        openCtrl: addFilePathCtrl
                    };

                    PopupDialog.custom(
                        opts,
                        function (result) {
                            if (result.value === 'add') {
                                $scope.objects.push({
                                    filePath: result.filePath,
                                    create_at: new Date(),
                                    id: new Date().getTime()
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

                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'filePath',
                        name: 'File Path',
                        sequence: 1,
                        active: true
                    }
                ];
                $scope.gridActionButtons = [
                    {
                        label: 'Delete',
                        action: function () {
                            deleteRecord(gridMessages.delete);
                        },
                        sequence: 1
                    }
                ];


                $scope.exportFields = {
                    ignore: []
                };

                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter';

                var noCheckBoxChecked = function () {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'No item selected for the action.'
                        ), function () {}
                    );
                };

                $scope.getCheckedItems = function (obj) {
                    return obj.filter(function (el) {
                        return el.checked;
                    });
                };

                var deleteRecord = function (messageBody) {
                    var checkedArray = $scope.getCheckedItems($scope.objects);

                    if (checkedArray.length) {
                        var message = '';
                        PopupDialog.confirm(
                            localization.translate(
                                $scope,
                                null,
                                'Confirm: Delete record'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                message = function () {
                                    var result = messageBody.single;
                                    if (checkedArray.length > 1) {
                                        result = messageBody.plural;
                                    }
                                    return result;
                                }
                            ), function () {
                                $scope.objects = $scope.objects.filter(function (el) {
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