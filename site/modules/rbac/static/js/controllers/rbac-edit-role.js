'use strict';

(function (app) {
    app.controller('rbacRoleEditController', [
        '$scope',
        'Account',
        function ($scope, Account) {
            $scope.loading = true;
            $scope.account;

            $scope.roleID;
            var rules = [
                'rule1', 'rule2', 'rule3'
            ];

            $scope.members = [
                { label: 'Dan', value: 1 },
                { label: 'Dima', value: 2 },
                { label: 'Alexander', value: 3 },
                { label: 'Aider', value: 4 }
            ];

            var role = {};
            $scope.policies = [
                {
                    name: "machine",
                    rules: rules,
                    description: 'test policie',
                    id: '123ds45-2341-asdfd-asdfas'
                },
                {
                    name: "Firewalls",
                    rules: rules,
                    description: 'test policie',
                    id: '123sc45-2341-asdfd-asdfas'
                },
                {
                    name: "images",
                    rules: rules,
                    description: 'test policie',
                    id: '12ew345-2341-asdfd-asdfas'
                },
                {
                    name: "packages",
                    rules: rules,
                    description: 'test policie',
                    id: '1234675-2341-asdfd-asdfas'
                }
            ];

            Account.getAccount(true).then(function (account) {
                $scope.account = account;
                $scope.loading = false;

//                setTimeout(function () {
//                    angular.element('#policies').jstree({
//                        "core": {
//                            "themes": {
//                                "icons": false
//                            }
//                        },
//                        "checkbox" : {
//                            "keep_selected_style" : false
//                        },
//                        "plugins" : [ "checkbox" ]
//                    });
//                });

            });

            $scope.createRole = function () {

            };



        }
    ]);
}(window.JP.getModule('Rbac')));