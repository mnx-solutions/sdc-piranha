'use strict';

(function (app) {
    app.controller('mdbController', [
        '$q',
        '$scope',
        'requestContext',
        'localization',
        'mdb',
        'Account',
        'PopupDialog',
        '$location',
        function ($q, $scope, requestContext, localization, mdb, Account, PopupDialog, $location) {
            localization.bind('mdb', $scope);
            requestContext.setUpRenderContext('mdb.index', $scope);
            $scope.mantaUnavailable = true;

            $scope.gridUserConfig = Account.getUserConfig().$child('MdbJobs');
            Account.getAccount(true).then(function (account) {
                $scope.provisionEnabled = account.provisionEnabled;
                if ($scope.provisionEnabled) {
                    mdb.getDebugJobsList().then(function (list) {
                        $scope.mantaUnavailable = false;
                        $scope.objects = list;
                        $scope.loading = false;
                    }, function (err) {
                        $scope.loading = false;
                        if (!err.message) {
                            err.message = err.code || err.errno || 'Internal error';
                        }
                        $scope.mantaUnavailable = true;
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

            var jobTime = function (item) {
                var result = 'N/A';
                if (item.dateEnd && item.date) {
                    var time = (new Date(item.dateEnd).getTime() - new Date(item.date).getTime()) / 1000;
                    var seconds = Math.round(time % 60);
                    time /= 60;
                    var minutes = Math.round(time % 60);
                    result = minutes + ' min ' + seconds + ' sec';
                }

                return result;
            };

            var actionMessages = {
                delete: {
                    single: 'Are you sure you want to delete the selected job?',
                    plural: 'Are you sure you want to delete the selected jobs?'
                }
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
                        }
                        return $scope.getStatus(item);
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
                    sequence: 5,
                    active: true,
                    type: 'html',
                    _order: function (item) {
                        return jobTime(item);
                    },
                    _getter: function (item) {
                        return jobTime(item);
                    }
                }
            ];
            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        makeJobAction('Confirm: Delete job', actionMessages.delete);
                    },
                    sequence: 1
                }
            ];
            $scope.exportFields = {
                ignore: 'all'
            };

            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };
            $scope.getCheckedItems = function () {
                return $scope.objects.filter(function (el) {
                    return el.checked;
                });
            };
            $scope.noCheckBoxChecked = function () {
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'No job selected for the action.'
                    )
                );
            };

            function makeJobAction(messageTitle, messageBody) {
                var checkedItems = $scope.getCheckedItems();
                if (checkedItems.length) {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            messageTitle
                        ),
                        localization.translate(
                            $scope,
                            null,
                            checkedItems.length > 1 ? messageBody.plural : messageBody.single
                        ),
                        function () {
                            $scope.loading = true;
                            var deleteIds = checkedItems.map(function (item) {
                                return item.jobId;
                            });
                            mdb.deleteJob(deleteIds).then(function () {
                                getJobsList();
                            }, errorCallback);
                        }
                    );
                } else {
                    $scope.noCheckBoxChecked();
                }
            }
            var getJobsList = function () {
                mdb.getDebugJobsList().then(function (list) {
                    $scope.mantaUnavailable = false;
                    $scope.loading = false;
                    $scope.objects = list;
                }, function (error) {
                    $scope.mantaUnavailable = true;
                    $scope.loading = false;
                    PopupDialog.error(null, error);
                });
            };

            $scope.addNewJob = function () {
                if ($scope.provisionEnabled) {
                    if ($scope.mantaUnavailable) {
                        PopupDialog.error(null, 'Manta is unavailable.');
                    } else {
                        $location.path('/mdb/create');
                    }
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