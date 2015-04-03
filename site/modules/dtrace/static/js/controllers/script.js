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
            '$location',
            function ($scope, DTrace, Storage, requestContext, localization, PopupDialog, $location) {
                localization.bind('dtrace', $scope);
                requestContext.setUpRenderContext('dtrace.script', $scope, {
                    title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Script Details')
                });

                $scope.loading = true;
                $scope.scriptId = requestContext.getParam('id') === 'create' ? false : requestContext.getParam('id');

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                var indexPage =  function () {
                    $location.path('/dtrace/scripts');
                };

                var newScript = function () {
                    $scope.script = {
                        name: '',
                        body: ''
                    };
                };

                var oldScriptName;
                var scriptsList = [];
                Storage.pingManta(function () {
                    DTrace.getScriptsList().then(function (list) {
                        scriptsList = list;
                        if ($scope.scriptId) {
                            $scope.script = scriptsList.find(function (script) {
                                return script.id === $scope.scriptId;
                            });
                            if ($scope.script) {
                                $scope.scriptName = oldScriptName = $scope.script.name;
                            } else {
                                newScript();
                            }
                        } else {
                            newScript();
                        }
                        $scope.loading = false;
                    }, function (error) {
                        PopupDialog.error(null, error);
                        indexPage();
                    });
                });

                $scope.$watch('scriptName', function (name) {
                    if (scriptsList.length) {
                        var script = scriptsList.find(function (script) {
                            return script.name === name;
                        });
                        if (script && oldScriptName !== name) {
                            $scope.scriptForm.$setValidity('unique', false);
                        } else {
                            $scope.scriptForm.$setValidity('unique', true);
                        }
                    }
                });

                $scope.saveScript = function () {
                    //TODO validate script
                    $scope.loading = true;
                    $scope.script.id = $scope.script.id || uuid();
                    $scope.script.name = $scope.scriptName;
                    DTrace.createScript($scope.script).then(function () {
                        indexPage();
                    }, errorCallback);
                };

            }
        ]);
}(window.JP.getModule('dtrace')));
