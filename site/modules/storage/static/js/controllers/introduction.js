'use strict';

(function (app) {
    app.controller(
        'IntroductionController', [
            '$scope', 'Account', 'requestContext', 'localization', 'rbac.Service', 'PopupDialog', '$q', 'Docker',
            'Datacenter', 'Storage', '$dialog',
            function ($scope, Account, requestContext, localization, RBAC, PopupDialog, $q, Docker, Datacenter,
                      Storage, $dialog) {
                localization.bind('introduction', $scope);
                requestContext.setUpRenderContext('storage.introduction', $scope);
                var dockerEnabled = $scope.features.docker === 'enabled';
                $scope.loading = true;

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };
                var createSshList = function (keys) {
                    if (keys.length > 0) {
                        keys.forEach(function (key) {
                            if (key.name === key.fingerprint) {
                                key.name = key.name.split(':').splice(-5).join('');
                            }
                        });
                        $scope.keyId = keys[0].fingerprint;
                        $scope.keyName = keys[0].name;
                    }
                    $scope.sshKeys = keys;
                    $scope.loading = false;
                };
                $scope.openVideo = function () {
                    var d = $dialog.dialog({
                        backdrop: true,
                        keyboard: true,
                        dialogClass: 'video',
                        backdropClick: true,
                        template: '<iframe src="https://player.vimeo.com/video/68515490" width="640" height="320" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>',
                        controller: 'StorageDialogController'
                    });
                    d.open();
                };
                $scope.changeKey = function (fingerprint) {
                    $scope.keyId = fingerprint;
                };
                $scope.setDatacenter = function (datacenter) {
                    $scope.datacenter = datacenter;
                };
                $scope.setHost = function (host) {
                    if (host && host.primaryIp) {
                        $scope.host = host;
                    }
                };
                $scope.getDatacenterUrl = function (datacenterName) {
                    var selectedDatacenter = $scope.datacenters && $scope.datacenters.find(function (datacenter) {
                        return datacenter.name === datacenterName;
                    });
                    return selectedDatacenter && selectedDatacenter.url;
                };
                var requestsList = [
                    Account.getAccount(),
                    Datacenter.datacenter()
                ];
                if (dockerEnabled) {
                    requestsList.push(Docker.listHosts());
                }
                $q.all(requestsList).then(function (result) {
                    $scope.account = result[0] || {};
                    $scope.datacenters = result[1] || [];
                    $scope.permittedHosts = dockerEnabled ? result[2] || [] : [];

                    if ($scope.account.isSubuser) {
                        RBAC.listUserKeys($scope.account.id).then(function (keys) {
                            createSshList(keys);
                            Account.getParentAccount().then(function (parentAccount) {
                                $scope.parentAccount = parentAccount.login;
                            }, function (err) {
                                $scope.parentAccount = err && err.message ? err.message : 'You do not have permission to access /my (getaccount)';
                            });
                        }, errorCallback);
                    } else {
                        Account.getKeys(true).then(function (keys) {
                            createSshList(keys);
                        });
                    }
                    $scope.host = $scope.permittedHosts[0] || null;
                    $scope.datacenter = $scope.datacenters[0] || null;
                });
                $scope.mantaUrl = 'https://us-east.manta.joyent.com';
                if ($scope.features.manta === 'enabled') {
                    Storage.getMantaUrl().then(function (url) {
                        $scope.mantaUrl = url;
                    });
                }
            }
        ]
    );
}(window.JP.getModule('Storage')));
