'use strict';

(function (app) {
    app.controller('RBAC.UserListController', [
        '$scope',
        'PopupDialog',
        'Account',
        function ($scope, PopupDialog, Account) {
            $scope.loading = true;
            $scope.users = [];
            Account.listUsers().then(function (users) {
                $scope.users = users || [];
                $scope.loading = false;
            }, function (err) {
                PopupDialog.errorObj(err);
            });

            $scope.gridUserConfig = Account.getUserConfig().$child('rbac') || {};

            $scope.gridOrder = ['-published_at'];
            $scope.gridProps = [
                {
                    id: 'login',
                    name: 'Login',
                    sequence: 1,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/rbac/user/' + object.id+'">'+object.login+'</a>';
                    },
                    active: true
                },
                {
                    id: 'email',
                    name: 'Email',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'created',
                    name: 'Created Date',
                    sequence: 3,
                    type: 'date',
                    active: true
                },
                {
                    id: 'role',
                    name: 'Role',
                    sequence: 4,
                    active: true
                }
            ];
            $scope.gridDetailProps = [];

            $scope.exportFields = {
                ignore: []
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

        }
    ]);
}(window.JP.getModule('Rbac')));