'use strict';

(function (app) {

    app.controller('Account.SSHController', [
        '$scope',
        '$window',
        '$timeout',
        '$q',
        '$location',
        '$http',
        'Account',
        'localization',
        'requestContext',
        'notification',
        'util',

        function ($scope, $window, $timeout, $q, $location, $http, Account, localization, requestContext, notification, util) {
            requestContext.setUpRenderContext('account.ssh', $scope);
            localization.bind('account', $scope);

            $scope.key = {};
            $scope.userPlatform = $window.navigator.platform;

        }]);
}(window.JP.getModule('Account')));