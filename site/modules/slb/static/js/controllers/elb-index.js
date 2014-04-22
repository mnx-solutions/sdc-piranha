'use strict';

(function (app) {
    app.controller(
        'slb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'slb.Service', 'Datacenter', 'PopupDialog',
        function ($scope, requestContext, localization, $location, service, Datacenter, PopupDialog) {
            localization.bind('slb', $scope);
            requestContext.setUpRenderContext('slb.index', $scope, {
                title: localization.translate(null, 'slb', 'Enable Load Balancing')
            });

            $scope.loaded = false;
            $scope.creating = false;

            service.getController().then(function () {
                $location.path('/slb/list');
            }, function () {
                $scope.loaded = true;
            });

            function showPopupDialog(level, title, message, callback) {
                return PopupDialog[level](
                    title ? localization.translate(
                        $scope,
                        null,
                        title
                    ) : null,
                    message ? localization.translate(
                        $scope,
                        null,
                        message
                    ) : null,
                    callback
                );
            }

            function showErrPopupDialog(error) {
                var message;
                var callback;
                if (error.statusCode === 403) {
                    callback = function () {
                        location.href = '/#!/account/payment'
                    };
                } else if (error.code === 'ECONNREFUSED' && !error.message) {
                    message = 'Connection refused';
                }

                if (!message) {
                    message = error.message || error;
                }

                $scope.creating = false;
                return showPopupDialog('error', 'Error', message, callback || angular.noop);
            }

            $scope.enableSlb = function () {
                $scope.creating = true;
                service.createController().then(function () {
                    $location.path('/slb/list');
                }, showErrPopupDialog);
            };

            $scope.licenseAcceptCheck = false;
            $scope.licenseAccept = function () {
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            };

        }]
    );
}(window.JP.getModule('slb')));
