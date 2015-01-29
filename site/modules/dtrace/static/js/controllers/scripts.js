'use strict';

(function (app) {
    app.controller(
        'DTrace.ScriptsController', [
            '$scope',
            'DTrace',
            'Account',
            'requestContext',
            'localization',
            'PopupDialog',
            '$location',
            function ($scope, DTrace, Account, requestContext, localization, PopupDialog, $location) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.scripts', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Scripts')
                });

                $scope.loading = true;
                $scope.checkedItems = [];

                var loadList = function () {
                    DTrace.getScriptsList().then(function (list) {
                        $scope.scripts = list || [];
                        $scope.loading = false;
                    }, errorCallback);
                };

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('dtrace-scripts');
                }

                $scope.gridOrder = ['-Created'];
                $scope.gridProps = [
                    {
                        id: 'name',
                        name: 'Name',
                        sequence: 1,
                        type: 'html',
                        _getter: function (object) {
                            return '<a href="#!/dtrace/script/' + object.id + '">' + object.name + '</a>';
                        },
                        active: true
                    },
                    {
                        id: 'created',
                        name: 'Created',
                        sequence: 2,
                        type: 'date',
                        active: true

                    },
                    {
                        id: 'body',
                        name: 'Body',
                        sequence: 3,
                        active: true
                    }
                ];

                var gridMessages = {
                    delete: {
                        single: 'Please confirm that you want to remove this script.',
                        plural: 'Please confirm that you want to remove selected scripts.'
                    }
                };

                $scope.gridActionButtons = [
                    {
                        label: 'Delete',
                        action: function () {
                            if (!$scope.checkedItems.length) {
                                return PopupDialog.noItemsSelectedError('scripts');
                            }
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete script'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    gridMessages.delete[$scope.checkedItems.length > 1 ? 'plural' : 'single']
                                ),
                                function () {
                                    var scriptsId = $scope.checkedItems.map(function (script) {
                                        script.actionInProgress = true;
                                        script.checked = false;
                                        return script.id;
                                    });
                                    $scope.checkedItems = [];
                                    DTrace.removeScript(scriptsId).then(function () {
                                        loadList();
                                    }, errorCallback);
                                }
                            );
                        },
                        sequence: 1
                    }
                ];


                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter scripts';

                $scope.createScript = function () {
                    $location.path('/dtrace/script/create');
                };

                loadList();

            }
        ]);
}(window.JP.getModule('dtrace')));
