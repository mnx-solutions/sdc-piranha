'use strict';

(function (app) {
    app.controller('rbac.PolicyListController', [
        '$q',
        '$scope',
        'Account',
        'rbac.Service',
        '$location',
        'PopupDialog',
        'localization',
        function ($q, $scope, Account, service, $location, PopupDialog, localization) {
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

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            $scope.getCheckedItems = function () {
                return $scope.policies.filter(function (el) {
                    return el.checked;
                });
            };

            $scope.noCheckBoxChecked = function () {
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'No policy selected for the action.'
                    ), function () {}
                );
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
            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function (object) {
                        var titleEnding = 'y';
                        var checkedItems = $scope.getCheckedItems();
                        if (checkedItems.length > 1) {
                            titleEnding = 'ies';
                        }
                        if (checkedItems.length) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete polic' + titleEnding
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete the selected polic' + titleEnding
                                ),
                                function () {
                                    $scope.loading = true;
                                    var deleteTasks = [];
                                    checkedItems.forEach(function (item) {
                                        deleteTasks.push($q.when(service.deletePolicy(item.id)));
                                    });
                                    $q.all(deleteTasks).then(function () {
                                        service.listPolicies().then(function (policies) {
                                            $scope.policies = policies;
                                            $scope.loading = false;
                                        }, errorCallback);
                                    }, errorCallback);
                                }
                            );
                        } else {
                            $scope.noCheckBoxChecked();
                        }
                    },
                    sequence: 1
                }
            ];

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