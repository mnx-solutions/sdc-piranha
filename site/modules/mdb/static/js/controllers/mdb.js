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
            });
            $scope.objects = [];
            $scope.loading = true;

            $scope.getStatus = function (item) {
                var getStatus = function () {
                    mdb.getJobFromList(item.jobId).then(function (job) {
                        if (job.status === 'Processed' || job.status === 'Failed' || item.status === 'Cancelled') {
                            $scope.objects.some(function (object) {
                                if (object.jobId === item.jobId) {
                                    object.dateEnd = job.dateEnd;
                                    return true;
                                }
                                return false;
                            });
                            item.status = job.status;
                        } else {
                            item.status = job.status;
                            setTimeout(getStatus, 10000);
                        }
                    });
                };
                getStatus();
                return item.status;
            };

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
                    active: true,
                    type: 'html',
                    _getter: function (item) {
                        return '<a href="#!/mdb/' + item.jobId + '">' + item.coreFile + '</a>';
                    }
                },
                {
                    id: 'date',
                    name: 'Created',
                    sequence: 2,
                    type: 'date',
                    active: true
                },
                {
                    id: 'status',
                    name: 'Status',
                    sequence: 3,
                    active: true,
                    type: 'async',
                    _getter: function (item) {
                        if (item.status === 'Processed' || item.status === 'Failed' || item.status === 'Cancelled') {
                            return item.status;
                        } else {
                            return $scope.getStatus(item);
                        }
                    }
                },
                {
                    id: 'dateEnd',
                    name: 'Completed',
                    sequence: 4,
                    active: true,
                    type: 'html',
                    _getter: function (item) {
                        var result = 'N/A';
                        if (item.dateEnd) {
                            result = window.moment(item.dateEnd).format('YYYY-MM-DD HH:mm');
                        }
                        return result;
                    }
                },
                {
                    id: 'time',
                    name: 'Time',
                    sequence: 4,
                    active: true,
                    type: 'html',
                    _getter: function (item) {
                        var result = 'N/A';
                        if (item.dateEnd && item.date) {
                            var time = (new Date(item.dateEnd).getTime() - new Date(item.date).getTime()) / 1000;
                            time /= 60;
                            result = Math.round(time % 60).toString() + 'm';
                        }
                        return result;
                    }
                }
            ];
            $scope.gridActionButtons = [];
            $scope.exportFields = {
                ignore: 'all'
            };

            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

            mdb.getDebugJobsList().then(function (list) {
                $scope.loading = false;
                $scope.objects = list;
            }, function (error) {
                $scope.loading = false;
                PopupDialog.error(null, error);
            });

            $scope.addNewJob = function () {
                if ($scope.provisionEnabled) {
                    $location.path('/mdb/create');
                } else {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Node.js Debugger'
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