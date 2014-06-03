'use strict';

(function (app) {
    app.controller('rbac.RoleListController', [
        '$q',
        '$scope',
        'requestContext',
        'Account',
        'rbac.Service',
        '$location',
        function ($q, $scope, requestContext, Account, service, $location) {
            $scope.loading = true;

            $scope.roles = [];

            $q.all([
                $q.when(service.listRoles()),
                $q.when(Account.getAccount())
            ]).then(function (result) {
                $scope.roles = result[0] || [];
                $scope.account = result[1];
                $scope.loading = false;
            });

            $scope.addNewRole = function () {
                $location.path('rbac/role/create');
            };


            $scope.gridUserConfig = Account.getUserConfig().$child('rbac') || {};

            $scope.gridOrder = ['-published_at'];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1,
                    active: true,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/rbac/role/' + object.id + '">' + object.name + '</a>';
                    }

                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'members',
                    name: 'Members',
                    sequence: 3,
                    type: 'array',
                    active: true
                },
                {
                    id: 'policies',
                    name: 'Policies',
                    sequence: 4,
                    type: 'array',
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
}(window.JP.getModule('rbac')));