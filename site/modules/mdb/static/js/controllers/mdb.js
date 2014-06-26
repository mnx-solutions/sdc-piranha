'use strict';

(function (app) {
    app.controller('mdbController', [
        '$scope',
        'requestContext',
        'localization',
        'mdb',
        'Account',
        'PopupDialog',
        '$location',
        function ($scope, requestContext, localization, mdb, Account, PopupDialog, $location) {
            localization.bind('mdb', $scope);
            requestContext.setUpRenderContext('mdb.index', $scope);

            $scope.gridUserConfig = Account.getUserConfig().$child('MdbJobs');
            Account.getAccount(true).then(function (account) {
                $scope.provisionEnabled = account.provisionEnabled;
            });
            $scope.objects = [];
            $scope.loading = true;

            $scope.gridProps = [
                {
                    id: 'jobId',
                    name: 'Job',
                    sequence: 0,
                    active: true,
                    type: 'html',
                    _getter: function (item) {
                        return '<a href="#!/mdb/' + item.jobId + '" style="min-width: 140px;">' + item.jobId + '</a>';
                    }
                },
                {
                    id: 'coreFile',
                    name: 'Core File',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'date',
                    name: 'Created',
                    sequence: 2,
                    active: true
                }
            ];
            $scope.gridActionButtons = [];
            $scope.exportFields = {
                ignore: 'all'
            };

            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

            if ($scope.provisionEnabled) {
                mdb.getDebugJobsList().then(function (list) {
                    $scope.loading = false;
                    $scope.objects = list;
                }, function (err) {
                    $scope.loading = false;
                    if (!err.message) {
                        err.message = err.code || err.errno || 'Internal error';
                    }
                    PopupDialog.error(null, err.message);
                });
            } else {
                $scope.loading = false;
            }


            $scope.addNewJob = function () {
                if ($scope.provisionEnabled) {
                    $location.path('/mdb/create');
                } else {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Debug Node.js'
                    };
                    Account.checkProvisioning(submitBillingInfo, null, null, function (isSuccess) {
                        $scope.loading = false;
                        if (isSuccess) {
                            $scope.provisionEnabled = true;
                            $location.path('/mdb/create');
                        } else {
                            $location.path('/mdb');
                        }
                    }, true);
                }
            };
        }
    ]);
}(window.JP.getModule('mdb')));