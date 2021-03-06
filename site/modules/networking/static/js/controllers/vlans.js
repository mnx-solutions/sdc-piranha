'use strict';

(function (app) {
    app.controller('Networking.VlansController', [
        '$scope',
        'PopupDialog',
        'Vlan',
        '$rootScope',
        'localization',
        'requestContext',
        '$location',
        function ($scope, PopupDialog, Vlan, $rootScope, localization, requestContext, $location) {
            localization.bind('networking', $scope);
            requestContext.setUpRenderContext('networking.vlans', $scope, {
                title: localization.translate(null, 'networking', 'Fabric VLANs')
            });
            $scope.loading = true;
            var CONFIG_KEY = 'vlansDatacenter';

            Vlan.vlan().then(function (vlans) {
                $scope.vlans = vlans || [];
                $scope.loading = false;
            });

            $scope.gotoCreatePage = function () {
                $location.path('/network/vlans/create');
                $location.replace();
            };

            $scope.gridUserConfig = 'vlans';
            $scope.gridOrder = ['name'];

            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    active: true,
                    sequence: 1,
                    _order: 'name',
                    type: 'html',
                    _getter: function (vlan) {
                        return '<a href="#!/network/vlans/' + vlan.datacenter + '/' + vlan.vlan_id + '">' + vlan.name + '</a>';
                    }
                },
                {
                    id: 'vlan_id',
                    name: 'VLAN ID',
                    active: true,
                    sequence: 2
                },
                {
                    id: 'description',
                    name: 'Description',
                    active: true,
                    sequence: 3
                },
                {
                    id: 'datacenter',
                    name: 'Datacenter',
                    active: true,
                    sequence: 4
                }
            ];

            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        PopupDialog.confirmAction(
                            'Delete Fabric VLAN',
                            'delete',
                            'VLAN',
                            $scope.checkedItems.length,
                            function () {
                                $scope.checkedItems.forEach(function (vlan) {
                                    Vlan.deleteVlan(vlan);
                                });
                            }
                        );
                    },
                    sequence: 1
                }
            ];

            $scope.columnsButton = true;
            $scope.exportFields = {};
            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.tabFilterField = 'datacenter';
            $scope.placeHolderText = 'filter vlans';
            $scope.tabFilterDefault = $rootScope.commonConfig(CONFIG_KEY);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig(CONFIG_KEY);
                } else {
                    $rootScope.commonConfig(CONFIG_KEY, tab);
                }
            });

        }
    ]);
}(window.JP.getModule('Networking')));
