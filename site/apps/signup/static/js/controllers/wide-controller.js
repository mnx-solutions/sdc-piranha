'use strict';

window.JP.main.controller(
        'WideController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
                requestContext.setUpRenderContext('wide', $scope);
        }]);