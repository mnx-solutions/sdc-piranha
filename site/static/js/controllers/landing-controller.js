'use strict';

window.JP.main.controller(
        'LandingController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
                requestContext.setUpRenderContext('landing', $scope);
            }
        ]);