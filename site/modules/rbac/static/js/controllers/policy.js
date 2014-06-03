'use strict';

(function (app) {
    app.controller('rbac.PolicyController', [
        '$q',
        '$scope',
        'Account',
        'rbac.Service',
        'PopupDialog',
        '$location',
        'requestContext',
        function ($q, $scope, Account, service, PopupDialog, $location, requestContext) {
            $scope.loading = true;
            $scope.model = {};
            $scope.model.newRule = '';
            $scope.model.policy = {};
            $scope.model.policy.rules = [];
            /*
             $scope.rules = [
             {name: 'rule', value: '* can createmachine *'},
             {name: 'rule', value: '* can deletemachine * if day = Wednesday'},
             {name: 'rule', value: '* can resizemachine *'}
             ];
             */

            $scope.policiesGrouping = [
                'Machine',
                'Images',
                'Firewall',
                'Networks'
            ];

            var policyId = requestContext.getParam('id');
            var isNew = policyId && policyId === 'create';
            if (!isNew) {
                $scope.model.policy.id = policyId;
                $q.all([
                    $q.when(service.getPolicy(policyId))
                ]).then(function (result) {
                    $scope.model.policy = result[0];
                    $scope.loading = false;

                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            } else {
                $scope.loading = false;
            }

            $scope.cancel = function () {
                $location.path('/rbac/policies');
            };


            var policyAction = function (action) {
                $scope.loading = true;
                action.then(function (data) {
                    $scope.loading = false;
                    $location.path('/rbac/policies');
                }, function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                });

            };
            $scope.createPolicy = function () {
                policyAction(service.createPolicy($scope.model.policy));
            };

            $scope.updatePolicy = function () {
                policyAction(service.updatePolicy($scope.model.policy));
            };

            $scope.deletePolicy = function () {
                policyAction(service.deletePolicy($scope.model.policy.id));
            };

            $scope.addRule = function () {
                $scope.model.policy.rules.push($scope.model.newRule);
                $scope.model.newRule = '';
            };

            $scope.removeRule = function (rule) {
                var pos = $scope.model.policy.rules.indexOf(rule);
                if (pos > -1) {
                    $scope.model.policy.rules.splice(pos, 1);
                }
            };

        }
    ]);
}(window.JP.getModule('rbac')));