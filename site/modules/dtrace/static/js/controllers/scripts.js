'use strict';

(function (app) {
    app.controller(
        'DTrace.ScriptsController', [
            '$scope',
            'DTrace',
            'Storage',
            'Account',
            'requestContext',
            'localization',
            'PopupDialog',
            '$location',
            function ($scope, DTrace, Storage, Account, requestContext, localization, PopupDialog, $location) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.scripts', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Scripts')
                });

                $scope.loading = true;
                $scope.checkedItems = [];
                $scope.devToolsPath = DTrace.devToolsLink();

                var loadList = function () {
                    DTrace.getScriptsList().then(function (list) {
                        $scope.scripts = [];
                        if (list) {
                            $scope.scripts = list.filter(function (script) {
                                return script.hasOwnProperty('id');
                            });
                        }
                        $scope.loading = false;
                    }, errorCallback);
                };

                var errorCallback = function (err) {
                    Storage.pingManta();
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
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        },
                        _getter: function (object) {
                            return '<a href="#!/devtools/dtrace/script/' + object.id + '">' + object.name + '</a>';
                        },
                        active: true
                    },
                    {
                        id: 'owner',
                        name: 'Owner',
                        sequence: 2,
                        type: 'html',
                        _getter: function (script) {
                            return script.owner || $scope.scriptOwner;
                        },
                        active: true
                    },
                    {
                        id: 'type',
                        name: 'Affiliations',
                        sequence: 3,
                        type: 'html',
                        _getter: function (script) {
                            return script.type || DTrace.SCRIPT_TYPES.private;
                        },
                        active: true
                    },
                    {
                        id: 'created',
                        name: 'Created',
                        sequence: 4,
                        type: 'date',
                        active: true

                    },
                    {
                        id: 'body',
                        name: 'Body',
                        sequence: 5,
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
                                    var selectedScripts = $scope.checkedItems.filter(function (script) {
                                        if (script.type === DTrace.SCRIPT_TYPES.remote) {
                                            script.checked = false;
                                            PopupDialog.message(null, 'Note: remote scripts can\'t be deleted.');
                                        }
                                        return script.type !== DTrace.SCRIPT_TYPES.remote;
                                    });
                                    if (selectedScripts.length) {
                                        var scriptsId = selectedScripts.map(function (script) {
                                            script.actionInProgress = true;
                                            script.checked = false;
                                            return script.id;
                                        });
                                        $scope.checkedItems = [];
                                        DTrace.removeScript(scriptsId).then(function () {
                                            loadList();
                                        }, errorCallback);
                                    }
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
                    var path = '/devtools/dtrace/script/create';
                    Account.checkProvisioning({btnTitle: 'Submit and Access DTrace Scripts'}, function () {
                        $location.path(path);
                    }, function (isSuccess) {
                        path = isSuccess ? path : '/devtools/dtrace/scripts';
                        $location.path(path);
                    }, true);
                };

                Account.getAccount(true).then(function (account) {
                    $scope.scriptOwner = account.login;
                    $scope.provisionEnabled = account.provisionEnabled;
                    if ($scope.provisionEnabled) {
                        Storage.pingManta(function () {
                            loadList();
                        });
                    } else {
                        $scope.loading = false;
                    }
                });

            }
        ]);
}(window.JP.getModule('dtrace')));
