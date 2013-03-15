'use strict';

(function (app) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
                requestContext.setUpRenderContext('signup', $scope);
            }
        ]);
}(window.JP.getModule('Signup')));