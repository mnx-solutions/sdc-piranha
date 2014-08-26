'use strict';

(function (app) {
    app.controller('cdnController', [
        '$q',
        '$scope',
        'requestContext',
        'localization',
        'cdn',
        'PopupDialog',
        function ($q, scope, requestContext, localization, cdn, PopupDialog) {
            localization.bind('cdn', scope);
            requestContext.setUpRenderContext('cdn.index', scope);

            scope.mantaUnavailable = false;
            scope.loading = true;
            scope.apiKey = '';

            var showError = function (err) {
                PopupDialog.error(
                    localization.translate(
                        scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        scope,
                        null,
                        err
                    )
                );
            };

            cdn.getApiKey().then(function (key) {
                scope.apiKey = key;
                scope.loading = false;
            }, function (err) {
                scope.loading = false;
                showError(err);
            });

            scope.apiKeyAction = function (actionType) {
                var apiKeyModalCtrl = function ($scope, dialog) {
                    $scope.title = 'Set API Key';
                    $scope.actionType = actionType;
                    if (actionType === 'update') {
                        $scope.title = 'Update API Key';
                    }

                    $scope.close = function (res) {
                        dialog.close(res);
                    };

                    $scope.action = function () {
                        $scope.close({
                            apiKey: $scope.apiKey
                        });
                    };
                };

                var opts = {
                    templateUrl: 'cdn/static/partials/api-key.html',
                    openCtrl: apiKeyModalCtrl
                };

                PopupDialog.custom(
                    opts,
                    function (data) {
                        if (data) {
                            scope.loading = true;
                            var options = {
                                key: data.apiKey
                            };
                            var successCallback = function () {
                                scope.apiKey = data.apiKey;
                                scope.loading = false;
                            };
                            var errorCallback = function (error) {
                                showError(error);
                                scope.loading = false;
                            };
                            if (actionType === 'save') {
                                cdn.addApiKey(options).then(successCallback, errorCallback);
                            }
                            if (actionType === 'update') {
                                cdn.updateApiKey(options).then(successCallback, errorCallback);
                            }
                        }
                    }
                );
            };
        }
    ]);
}(window.JP.getModule('mdb')));
