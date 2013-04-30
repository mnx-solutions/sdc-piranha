'use strict';

(function (app) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
                console.log('signup layout');
                requestContext.setUpRenderContext('signup', $scope);

            }
        ]);
}(window.JP.getModule('Signup')));