'use strict';

(function (app) {
    app.controller(
        'DTrace.ScriptController', [
            '$scope',
            'DTrace',
            'Storage',
            'requestContext',
            'localization',
            'PopupDialog',
            'Account',
            '$location',
            function ($scope, DTrace, Storage, requestContext, localization, PopupDialog, Account, $location) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my ' + $scope.company.name + ' DTrace Script Details')
                });

                $scope.loading = true;
                $scope.scriptId = requestContext.getParam('id') === 'create' ? false : requestContext.getParam('id');
                $scope.devToolsPath = DTrace.devToolsLink();
                $scope.scriptShared = $scope.copyRemoteScript = false;

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                var indexPage =  function () {
                    $location.path('/devtools/dtrace/scripts');
                };

                var newScript = function () {
                    $scope.script = {
                        name: '',
                        body: '',
                        type: DTrace.SCRIPT_TYPES.private
                    };
                };

                var oldScriptName;
                var scriptsList = [];
                DTrace.getScriptsList().then(function (list) {
                    Storage.pingManta();
                    scriptsList = list;
                    if ($scope.scriptId) {
                        $scope.script = scriptsList.find(function (script) {
                            return script.id === $scope.scriptId;
                        });
                        if ($scope.script) {
                            $scope.scriptName = oldScriptName = $scope.script.name;
                            $scope.scriptShared = $scope.script.type === DTrace.SCRIPT_TYPES.shared;
                        } else {
                            newScript();
                        }
                    } else {
                        newScript();
                    }
                    Account.getAccount(true).then(function (account) {
                        $scope.scriptOwner = account.login;
                        if ($scope.script.type !== DTrace.SCRIPT_TYPES.remote) {
                            $scope.script.owner = $scope.scriptOwner;
                        }
                    });
                    $scope.loading = false;
                }, function (error) {
                    PopupDialog.error(null, error);
                    indexPage();
                });

                $scope.checkScriptNameUniqueness = function (name) {
                    if (scriptsList.length) {
                        var script = scriptsList.find(function (script) {
                            return script.name === name && script.type !== DTrace.SCRIPT_TYPES.remote;
                        });
                        if (script && (oldScriptName !== name || $scope.copyRemoteScript &&
                            oldScriptName === name)) {
                            $scope.scriptForm.$setValidity('unique', false);
                        } else {
                            $scope.scriptForm.$setValidity('unique', true);
                        }
                    }
                };

                $scope.$watch('scriptName', function (name) {
                    $scope.checkScriptNameUniqueness(name);
                });

                $scope.saveScript = function () {
                    //TODO validate script
                    $scope.loading = true;
                    $scope.script.id = $scope.script.id || uuid();
                    $scope.script.name = $scope.scriptName;
                    if ($scope.copyRemoteScript) {
                        $scope.script.id = uuid();
                        $scope.script.owner = $scope.scriptOwner;
                        $scope.script.type = DTrace.SCRIPT_TYPES.private;
                        delete $scope.script.created;
                    }
                    DTrace.createScript($scope.script).then(function () {
                        indexPage();
                    }, errorCallback);
                };

                $scope.setScriptType = function () {
                    $scope.script.type = $scope.scriptShared ? DTrace.SCRIPT_TYPES.shared : DTrace.SCRIPT_TYPES.private;
                };

            }
        ]);
}(window.JP.getModule('dtrace')));
