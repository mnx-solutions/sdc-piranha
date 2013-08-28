'use strict';

(function (app) {
    app.controller(
        'StorageDialogController',['$scope', 'dialog',
            function($scope, dialog) {
                $scope.close = function () {
                    dialog.close();
                };
            }]
    );
}(window.JP.getModule('Storage')));