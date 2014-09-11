'use strict';

(function (app) {
    app.controller('cdnController', [
        '$q',
        '$scope',
        'requestContext',
        'localization',
        'cdn',
        'PopupDialog',
        'fileman',
        'Account',
        '$location',
        function ($q, scope, requestContext, localization, cdn, PopupDialog, fileman, Account, $location) {
            localization.bind('cdn', scope);
            requestContext.setUpRenderContext('cdn.index', scope);

            scope.gridUserConfig = Account.getUserConfig().$child('CdnConfigurations');

            scope.mantaUnavailable = false;
            scope.loading = true;
            scope.apiKey = '';
            scope.resetApiKey = false;
            scope.configurations = [];

            var showError = function (err, callback) {
                callback = callback || function () {};
                scope.loading = false;
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
                    ), callback
                );
            };
            var loadConfigurations = function () {
                cdn.listConfigurations({key: scope.apiKey}).then(function (configurations) {
                    if (configurations) {
                        scope.configurations = configurations;
                    }
                    scope.loading = false;
                }, function (err) {
                    if (/You are not authorized to perform this action/g.test(err)) {
                        scope.apiKey = '';
                        scope.resetApiKey = true;
                        err = 'You are not authorized, please set you API key.';
                    }
                    showError(err);
                });
            };
            Account.getAccount().then(function (account) {
                scope.provisionEnabled = account.provisionEnabled;
                if (scope.provisionEnabled) {
                    cdn.getApiKey().then(function (key) {
                        if (key) {
                            scope.apiKey = key;
                        }
                        loadConfigurations();
                    }, function (err) {
                        if (err && err.name === 'ConnectTimeoutError') {
                            showError(err.message, function () {
                                $location.url('/manta/intro');
                                $location.replace();
                            });
                            return;
                        }
                        scope.loading = false;
                    });
                } else {
                    scope.loading = false;
                }
            });

            scope.completeAccount = function () {
                var submitBillingInfo = {
                    btnTitle: 'Submit and Access Fastly',
                    appendPopupMessage: 'Manta access will now be granted.'
                };
                Account.checkProvisioning(submitBillingInfo, null, null, Storage.getAfterBillingHandler('/manta/cdn'), false);
            };

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
                                loadConfigurations();
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

            scope.createConfiguration = function () {
                var createConfigurationModalCtrl = function ($scope, dialog) {
                    $scope.title = 'Create CDN Configuration';
                    $scope.directory = '/public';
                    $scope.close = function (res) {
                        dialog.close(res);
                    };

                    $scope.create = function () {
                        fileman.info($scope.directory, function (error) {
                            if (error) {
                                showError('The directory not found');
                            } else {
                                $scope.close({
                                    name: $scope.name,
                                    domain: $scope.domain,
                                    key: scope.apiKey,
                                    directory: $scope.directory
                                });
                                PopupDialog.message(
                                    localization.translate(
                                        scope,
                                        null,
                                        'Create CDN Configuration'
                                    ),
                                    localization.translate(
                                        scope,
                                        null,
                                        'You’re almost configured. <a href="http://docs.fastly.com/guides/21837373/26628837" target="_blank">Please point CNAME of your domain to Fastly</a>'
                                    )
                                );
                            }
                        });
                    };
                };

                var opts = {
                    templateUrl: 'cdn/static/partials/create-configuration.html',
                    openCtrl: createConfigurationModalCtrl
                };

                PopupDialog.custom(
                    opts,
                    function (data) {
                        if (data) {
                            scope.loading = true;
                            cdn.createConfiguration(data).then(function () {
                                loadConfigurations();
                            }, function (error) {
                                showError(error);
                                scope.loading = false;
                            });
                        }
                    }
                );
            };

            function deleteConfiguration(messageTitle, messageBody) {
                if (scope.checkedItems.length) {
                    PopupDialog.confirm(
                        localization.translate(
                            scope,
                            null,
                            messageTitle
                        ),
                        localization.translate(
                            scope,
                            null,
                            scope.checkedItems.length > 1 ? messageBody.plural : messageBody.single
                        ),
                        function () {
                            scope.loading = true;
                            var deleteIds = scope.checkedItems.map(function (item) {
                                return item.id;
                            });
                            var opts = {
                                key: scope.apiKey,
                                ids: deleteIds
                            };
                            cdn.deleteConfiguration(opts).then(function () {
                                loadConfigurations();
                                scope.checkedItems = [];
                            }, function (err) {
                                loadConfigurations();
                                showError(err);
                            });
                        }
                    );
                }
            }
            scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 0,
                    active: true
                },
                {
                    id: 'directory',
                    name: 'Manta Directory',
                    sequence: 0,
                    active: true
                },
                {
                    id: 'domainActive',
                    name: 'Domain Setup',
                    sequence: 0,
                    active: true,
                    type: 'async',
                    _getter: function (object) {
                        if (!object.domainActive) {
                            return cdn.domainStatus({key: scope.apiKey, service_id: object.service_id, domain: object.domain}).then(function (status) {
                                return status === true ? 'Yes' : 'No';
                            }, showError);
                        }
                        return 'Yes';
                    }
                }
            ];

            scope.exportFields = {
                ignore: 'all'
            };

            scope.enabledCheckboxes = true;
            scope.searchForm = true;
            var actionMessages = {
                delete: {
                    single: 'Are you sure you want to delete the selected configuration?',
                    plural: 'Are you sure you want to delete the selected configurations?'
                }
            };

            scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        deleteConfiguration('Confirm: Delete configurations', actionMessages.delete);
                    },
                    sequence: 1
                }
            ];
        }
    ]);
}(window.JP.getModule('cdn')));
