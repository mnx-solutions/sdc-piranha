'use strict';

(function (app) {
    app.directive('createInstanceLink', ['$location', function ($location) {
        return {
            restrict: 'E',
            scope: {
                path: '@',
                type: '@',
                action: '&'
            },
            link: function ($scope) {
                switch ($scope.type) {
                    case 'container':
                        $scope.linkTitle = 'Docker';
                        break;

                    case 'native-container':
                        $scope.linkTitle = 'Infrastructure Container';
                        break;

                    case 'virtual-machine':
                        $scope.linkTitle = 'Hardware Virtual Machine';
                        break;

                    default:
                        $scope.linkTitle = 'Quick';
                }
                $scope.checkIsLinkActive = function () {
                    return $scope.isLinkActive = $location.path().search($scope.path) > -1;
                };
                $scope.checkIsLinkActive();
            },
            templateUrl: 'machine/static/partials/create-instance-link.html'
        };
    }]);
}(window.JP.getModule('Machine')));
