'use strict';

(function (app) {
    app.controller(
        'DTrace.ScriptController', [
            '$scope',
            'DTrace',
            'requestContext',
            'localization',
            'PopupDialog',
            '$location',
            'util',
            function ($scope, DTrace, requestContext, localization, PopupDialog, $location, util) {
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

                DTrace.getScriptsList().then(function (list) {
                    $scope.list = list;
                    $scope.loading = false;
                }, function (error) {
                    PopupDialog.error(null, error);
                    indexPage();
                });

                if ($scope.scriptId) {
                    $scope.script = $scope.list.find(function (script) {
                        return script.id === $scope.scriptId;
                    });
                } else {
                    newScript();
                    $scope.loading = false;
                }

                $scope.$watch('script.name', function (name) {
                    if ($scope.list && $scope.list.length) {
                        var script = $scope.list.find(function (script) {
                            return script.name === name;
                        });
                        if (script) {
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
                    DTrace.createScript($scope.script).then(function () {
                        indexPage();
                    }, errorCallback);
                };

            }
        ]);
}(window.JP.getModule('dtrace')));
