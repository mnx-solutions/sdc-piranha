'use strict';

(function (app) {
    app.controller('rbacUserController', [
        '$scope',
        '$location',
        'requestContext',
        'PopupDialog',
        'Account',
        function ($scope, $location, requestContext, PopupDialog, Account) {
            $scope.loading = true;
            $scope.user = {};
            $scope.roles = [];

            $scope.roles = [
                { name: 'Operations', value: 1 },
                { name: 'Engineering', value: 2 },
                { name: 'Support', value: 3 },
                { name: 'Release Management', value: 4 }
            ];
            var userId = requestContext.getParam('id');
            $scope.user.isNew = userId === 'create';
            if (!$scope.user.isNew) {
                Account.getUser(userId).then(function (user) {
                    $scope.user = user;
                    $scope.user.roles = $scope.user.roles || [];
                    $scope.loading = false;
                });
            } else {
                $scope.loading = false;
            }

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };


            $scope.updateUser = function () {
                $scope.loading = true;
                Account.updateUser($scope.user).then(function (data) {
                    $scope.loading = false;
                }, errorCallback);
            };

            $scope.createUser = function () {
                $scope.loading = true;
                Account.createUser($scope.user).then(function (data) {
                    $scope.loading = false;
                    $location.path('/rbac');
                }, errorCallback);
            };

            $scope.deleteUser = function () {
                $scope.loading = true;
                Account.deleteUser($scope.user.id).then(function (data) {
                    $scope.loading = false;
                    $location.path('/rbac');
                }, errorCallback);
            };

            $scope.changeUserPassword = function (password, passwordConfirmation) {
                $scope.loading = true;
                Account.changeUserPassword($scope.user.id, password, passwordConfirmation).then(function (data) {
                    $scope.loading = false;
                }, errorCallback);
            };

            $scope.cancel = function () {
                $location.path('/rbac')
            };

        }
    ]);
}(window.JP.getModule('Rbac')));