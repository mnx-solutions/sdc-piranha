'use strict';

(function (app) {
    app.directive('builderGrid', ['PopupDialog', 'localization', function (PopupDialog, localization) {
        return {
            restrict: 'EA',
            scope: {
                objects: '='
            },

            link: function (scope) {
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
                            PopupDialog.confirmAction(
                                'Delete record',
                                'delete',
                                'record',
                                scope.checkedItems.length,
                                function () {
                                    scope.objects = scope.objects.filter(function (el) {
                                        return !el.checked;
                                    });
                                    scope.checkedItems = [];
                                }
                            );
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
            },

            templateUrl: 'storage/static/partials/builder-grid.html'
        };
    }]);
}(window.JP.getModule('Storage')));