'use strict';

(function (app) {
    app.controller(
        'downloadSdc.IndexController',
        [ '$scope', 'loggingService', 'localization', 'PopupDialog', 'sdcService', 'requestContext',

            function ($scope, loggingService, localization, PopupDialog, sdcService, requestContext) {
                requestContext.setUpRenderContext('downloadSdc.index', $scope);

                var sdcInfo = {};
                $scope.versionSDC = 'fullSdc';
                $scope.acceptLicenseAgreement = false;
                loggingService.log('info', 'User accessed SDC download page.');

                sdcService.getSdcInfo().then(function (data) {
                     sdcInfo = data;
                });

                function capitalize(string) {
                    return string.charAt(0).toUpperCase() + string.slice(1);
                }

                $scope.acceptLicense = function (startDownloading) {
                    if (!$scope.acceptLicenseAgreement && !startDownloading) {
                        $scope.acceptLicenseAgreement = false;
                        return;
                    }
                    var isAccepted = false;
                    var acceptLicenseModalCtrl = function ($scope, dialog) {
                        $scope.title = 'Accept End-User License Agreement';
                        $scope.message = {
                            templatePath: sdcInfo.eula
                        };
                        $scope.buttons = [
                            {
                                result: 'cancel',
                                label: 'No',
                                cssClass: 'btn grey',
                                setFocus: false
                            },
                            {
                                result: 'ok',
                                label: 'Yes',
                                cssClass: 'btn orange',
                                setFocus: true
                            }
                        ];
                        $scope.close = function (res) {
                            if (res === 'ok') {
                                isAccepted = true;
                            }
                            dialog.close(res);
                        };
                    };
                    $scope.acceptLicenseAgreement = isAccepted;
                    var opts = {
                        templateUrl: 'dialog/static/partials/confirmationDialog.html',
                        openCtrl: acceptLicenseModalCtrl
                    };
                    PopupDialog.custom(opts, function () {
                        $scope.acceptLicenseAgreement = isAccepted;
                        if (startDownloading && isAccepted) {
                            $scope.startDownload();
                        }
                    });
                };

                $scope.startDownload = function () {
                    var sdcUrl;
                    var downloadPackage = '';

                    if (!$scope.acceptLicenseAgreement) {
                        $scope.acceptLicense(true);
                        return;
                    }

                    if ($scope.versionSDC === 'coalSdc') {
                        downloadPackage = 'COAL SDC';
                        sdcUrl = sdcInfo.coalSdc;
                    } else if ($scope.versionSDC === 'fullSdc') {
                        downloadPackage = 'full version of SDC';
                        sdcUrl = sdcInfo.fullSdc;
                    }

                    if (!sdcUrl) {
                        PopupDialog.message(
                            localization.translate(
                                $scope,
                                null,
                                'Message'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                capitalize(downloadPackage) + ' is not available for download.'
                            ),
                            function () {}
                        );
                        return;
                    }

                    window.location.href = sdcUrl;
                    loggingService.log('info', 'User is downloading ' + downloadPackage);
                };

            }
        ]);
}(window.JP.getModule('downloadSdc')));
