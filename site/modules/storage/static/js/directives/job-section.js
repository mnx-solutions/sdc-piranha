'use strict';

(function (app) {
    app.directive('jobSection', ['fileman', function (fileman) {
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
                    return fileman.get(path, true);
                };
            },

            templateUrl: 'storage/static/partials/job-section.html'
        };
    }]);
}(window.JP.getModule('Storage')));

