'use strict';

(function (app) {
    app.controller(
        'ElbController',
        ['$scope', 'Account', 'requestContext', function ($scope, Account, requestContext) {
            requestContext.setUpRenderContext('elb.index', $scope);

        }]);
}(window.JP.getModule('ELB')));
