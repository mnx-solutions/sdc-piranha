'use strict';

(function (app) {
    app.directive('createInstanceLink', ['requestContext', '$location', function (requestContext, $location) {
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

                    case 'custom':
                        $scope.linkTitle = 'Saved';
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
                    var preSelectedImageId = requestContext.getParam('imageid') === 'custom' ? null :
                        requestContext.getParam('imageid');
                    var path = $scope.path;
                    if ($scope.type === 'container') {
                        path += '|compute/docker/welcome';
                    }
                    if (preSelectedImageId && !$location.search().specification) {
                        path = path.replace('custom', preSelectedImageId);
                    }
                    $scope.isLinkActive = $location.path().search(path) > -1;
                    return $scope.isLinkActive;
                };
                $scope.checkIsLinkActive();
            },
            templateUrl: 'machine/static/partials/create-instance-link.html'
        };
    }]);
}(window.JP.getModule('Machine')));
