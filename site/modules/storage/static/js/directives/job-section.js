'use strict';

(function (app) {
    app.directive('jobSection', [function () {
        return {
            restrict: 'EA',
            scope: {
                name: '=',
                objects: '='
            },

            link: function ($scope) {
                $scope.showSection = true;
                $scope.toggleSection = function () {
                    $scope.showSection = !$scope.showSection;
                };

            },

            templateUrl: 'storage/static/partials/job-section.html'
        };
    }]);
}(window.JP.getModule('Storage')));