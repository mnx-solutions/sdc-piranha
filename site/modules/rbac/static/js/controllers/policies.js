'use strict';

(function (app) {
    app.controller('rbac.PolicyListController', [
        '$q',
        '$scope',
        'Account',
        'rbac.Service',
        'PopupDialog',
        'localization',
        function ($q, $scope, Account, service, PopupDialog, localization) {
            $scope.loading = true;
            $scope.policies = [];
            service.listPolicies().then(function (policies) {
                $scope.policies = policies || [];
                $scope.loading = false;
            });

            var errorCallback = function () {
                $scope.loading = false;
            };

            $scope.noCheckBoxChecked = function () {
                PopupDialog.noItemsSelectedError('policy');
            };

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = 'rbac-policies';
            }

            $scope.gridOrder = ['name'];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1,
                    _order: 'name',
                    active: true,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/accounts/policy/' + object.id + '">' + object.name + '</a>';
                    }
                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 2,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/accounts/policy/' + object.id + '">' + object.id + '</a>';
                    },
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
                    action: function () {
                        if ($scope.checkedItems.length) {
                            var titleEnding = $scope.checkedItems.length === 1 ? 'y' : 'ies';
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete polic' + titleEnding
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete the selected polic' + titleEnding + '?'
                                ),
                                function () {
                                    $scope.loading = true;
                                    var deleteIds = $scope.checkedItems.map(function (item) {
                                        return item.id;
                                    });
                                    service.deletePolicy(deleteIds).then(function () {
                                        service.listPolicies().then(function (policies) {
                                            $scope.policies = policies;
                                            $scope.loading = false;
                                            $scope.checkedItems = [];
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
                ignore: ['checked']
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter policies';

        }
    ]);
}(window.JP.getModule('rbac')));