'use strict';

(function (app) {
    app.directive('builderGrid', ['PopupDialog', 'localization', 'Account', 'fileman', function (PopupDialog, localization, Account, fileman) {
        return {
            restrict: 'EA',
            scope: {
                objects: '='
            },

            link: function (scope) {
                function showPopupDialog(level, title, message, callback) {
                    return PopupDialog[level](
                        title ? localization.translate(scope, null, title) : null,
                        message ? localization.translate(scope, null, message) : null,
                        callback
                    );
                }

                function deleteRecord(messageBody) {
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
                            ),
                            function () {
                                scope.objects = scope.objects.filter(function (el) {
                                    return !el.checked;
                                });
                            }
                        );
                    } else {
                        showPopupDialog('error', 'Error', 'No item selected for the action.');
                    }
                }
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

                scope.getCheckedItems = function (obj) {
                    return obj.filter(function (el) {
                        return el.checked;
                    });
                };

            },

            templateUrl: 'storage/static/partials/builder-grid.html'
        };
    }]);
}(window.JP.getModule('Storage')));