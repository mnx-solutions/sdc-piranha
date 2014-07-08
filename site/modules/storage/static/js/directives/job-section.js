'use strict';

(function (app) {
    app.directive('jobSection', ['fileman', 'PopupDialog', function (fileman, PopupDialog) {
        return {
            restrict: 'EA',
            scope: {
                name: '=',
                objects: '=',
                length: '@'
            },

            link: function ($scope) {
                $scope.showSection = true;
                $scope.toggleSection = function () {
                    $scope.showSection = !$scope.showSection;
                };
                $scope.getFile = function (path) {
                    fileman.infoAbsolute(path, function (err, res) {
                        if (err) {
                            return PopupDialog.error(
                                'Error',
                                'The file has gone.'
                            );
                        }

                        fileman.get(path, true);

                    });
                };
            },

            templateUrl: 'storage/static/partials/job-section.html'
        };
    }]);
}(window.JP.getModule('Storage')));

