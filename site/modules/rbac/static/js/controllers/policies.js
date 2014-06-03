'use strict';

(function (app) {
    app.controller('rbac.PolicyListController', [
        '$scope',
        'Account',
        'rbac.Service',
        '$location',
        function ($scope, Account, service, $location) {
            $scope.loading = true;
            $scope.policies = [];
            service.listPolicies().then(function (policies) {
                $scope.policies = policies || [];
                $scope.loading = false;
            });

            $scope.policiesGrouping = [
                'Machine',
                'Images',
                'Firewall',
                'Networks'
            ];

            $scope.addNewPolicy = function () {
                $location.path('rbac/policy/create');
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
                        return '<a href="#!/rbac/policy/' + object.id + '">' + object.name + '</a>';
                    }

                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'rules',
                    name: 'Rules',
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