'use strict';

(function (app) {
    app.controller(
        'SignupLayoutController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
                requestContext.setUpRenderContext('signup', $scope);
            }
        ]);
}(window.JP.getModule('Signup')));