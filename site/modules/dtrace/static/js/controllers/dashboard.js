'use strict';

(function (app) {
    app.controller('Dtrace.IndexController', [
        '$scope',
        '$rootScope',
        '$q',
        'requestContext',
        'localization',
        '$location',
        'Datacenter',
        'Storage',
        'Image',
        'PopupDialog',
        'DTrace',
        'Account',
        'util',
        function ($scope, $rootScope, $q, requestContext, localization, $location, Datacenter, Storage, Image, PopupDialog, DTrace, Account, util) {
            localization.bind('dtrace.index', $scope);
            requestContext.setUpRenderContext('dtrace.index', $scope, {
                title: localization.translate(null, 'dtrace', 'See my Joyent DTrace Instances')
            });

            var DTRACE_IMAGE_OS = 'smartos';
            var MAX_DTRACE_VERSION = '14.4.0';
            var imageOrder = function (object) {
                var statuses = {nodejs: 1, standard64: 2, base64: 3};
                return statuses[object.name];
            };

            $scope.loading = true;
            $scope.states = {};
            $scope.data = {
                datacenter: '',
                imageId: ''
            };
            $scope.devToolsPath = DTrace.devToolsLink();

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            var getHostStatus = function (machine) {
                $scope.states[machine.id] = 'initializing';
                DTrace.hostStatus(machine).then(function (status) {
                    $scope.states[machine.id] = status || 'completed';
                }, function () {
                    $scope.states[machine.id] = 'unreachable';
                    errorCallback.apply(this, arguments);
                });
            };

            Datacenter.datacenter().then(function (datacenters) {
                $scope.datacenters = datacenters || [];
                $scope.data.datacenter = $scope.datacenters[0].name;
            });

            $q.all([
                $q.when(DTrace.listHosts()),
                Account.getAccount()
            ]).then(function (result) {
                $scope.dtraceMachines = [];
                var dtraceMachines = result[0] || [];
                var account = result[1] || {};
                $scope.provisionEnabled = account.provisionEnabled;
                if (dtraceMachines.length > 0 && $scope.provisionEnabled) {
                    $scope.dtraceMachines = dtraceMachines.filter(function (machine) {
                        getHostStatus(machine);
                        return machine.primaryIp;
                    });
                    Storage.pingManta(function () {
                        $scope.loading = false;
                    });
                } else {
                    $scope.loading = false;
                }
            }, function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            });

            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.data.imageId = '';
                    Image.image({datacenter: newVal, public: true}).then(function (images) {
                        var smartosImages = images.filter(function (image) {
                            return image.os === DTRACE_IMAGE_OS && imageOrder(image) && util.cmpVersion(MAX_DTRACE_VERSION, image.version) > 0;
                        });
                        if (smartosImages.length > 0) {
                            smartosImages.sort(function (a, b) {
                                var diff = imageOrder(a) - imageOrder(b);
                                return diff === 0 ? b.version.localeCompare(a.version) : diff;
                            });
                            $scope.data.imageId = smartosImages[0].id;
                        } else {
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'This data center has no “smartos” image suitable for creating dtrace host'
                                )
                            );
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                    });
                }
            });

            $scope.navigateMachine = function (machine) {
                $location.url('/compute/instance/' + machine.id);
            };

            $scope.createDtrace = function () {
                $rootScope.commonConfig('datacenter', $scope.data.datacenter);
                $location.url('/compute/create/' + $scope.data.imageId + '?specification=dtracehost');
            };

            $scope.completeAccount = function () {
                Account.checkProvisioning({btnTitle: 'Submit and Access DTrace'}, null, function () {
                    $location.path('/devtools/dtrace');
                }, false);
            };
        }
    ]);
}(window.JP.getModule('dtrace')));
