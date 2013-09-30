'use strict';

(function (ng, app) {
    app.controller('SignupController', [
        '$scope',
        'requestContext',

        function ($scope, requestContext) {
            requestContext.setUpRenderContext('signup.index', $scope);

        }

    ]);

}(window.angular, window.JP.getModule('Signup')));