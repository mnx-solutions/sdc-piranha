'use strict';

(function (app) {
    app.controller('mdbDetailController', [
        '$scope',
        'mdb',
        'PopupDialog',
        'Account',
        'localization',
        'requestContext',
        '$location',
        'Support',
        function ($scope, mdb, PopupDialog, Account, localization, requestContext, $location, Support) {
            localization.bind('mdb', $scope);
            requestContext.setUpRenderContext('mdb.index', $scope);
            var jobId = requestContext.getParam('jobId');
            var objectsToNumber = function (object) {
                return Number(object.objects);
            };
            $scope.inputFile = [];
            $scope.objects = [];
            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = Account.getUserConfig().$child('mdb');
            }
            $scope.gridOrder = [objectsToNumber];
            $scope.gridProps = [
                {
                    id: 'object',
                    name: 'Object',
                    sequence: 0,
                    active: false
                },
                {
                    id: 'objects',
                    name: '# Objects',
                    _order: objectsToNumber,
                    sequence: 1,
                    active: true
                },
                {
                    id: 'props',
                    name: '# Properties',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'constr',
                    name: 'Constructor',
                    sequence: 3,
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

            $scope.jobId = jobId !== 'create' ? jobId : null;
            $scope.status = 'Not Processed';
            $scope.supportStatus = '';
            $scope.processing = false;
            $scope.estimateTime = 0;

            function flushAll(status) {
                $scope.loading = false;
                $scope.status = status || 'Not Processed';
                $scope.jobId = null;
                $scope.objects = [];
            }

            $scope.getFilePath = function (full) {
                // get last object from (Array)inputFile and return filePath
                var filename = $scope.inputFile.length ? $scope.inputFile.slice(-1)[0].filePath : '';
                return full ? filename : filename.replace(/.*\/([^$]+)$/g, '$1');
            };

            function processResult(result) {
                $scope.loading = false;
                if (result.coreFile) {
                    $scope.inputFile = [{filePath: result.coreFile}];
                }
                if (result.status) {
                    $scope.status = result.status;
                }
                $scope.counters = {
                    'Heap Objects': result.counters['heap objects'],
                    'JavaScript Objects': result.counters['JavaScript objects'],
                    'Processed Objects': result.counters['processed objects'],
                    'Processed Arrays': result.counters['processed arrays']
                };
                $scope.objects = result.data;
                $scope.jobId = null;
                getEstimateTime();
            }

            $scope.process = function () {
                if ($scope.inputFile.length === 0) {
                    PopupDialog.error(null, 'You must add the core file.', flushAll);
                    return;
                }
                flushAll();
                $scope.processing = true;
                var callJob = mdb.process({coreFile: $scope.getFilePath(true)}, function (error, job) {
                    if (error) {
                        $scope.processing = false;
                        PopupDialog.error(null, error);
                    }
                    if (!$scope.processing) {
                        return;
                    }
                    var result = job.__read().slice(-1)[0];
                    if (result) {
                        if (result.status) {
                            $scope.status = result.status;
                        }
                        if (result.jobId) {
                            $scope.jobId = result.jobId;
                        }
                    }
                });

                callJob.then(function (result) {
                    if (!$scope.processing) {
                        return;
                    }
                    result = result.slice(-1)[0];
                    processResult(result);
                }, function (error) {
                    PopupDialog.error(null, error, flushAll('Failed'));
                });
            };

            $scope.cancel = function () {
                $scope.processing = false;
                $scope.status = 'Canceling';
                mdb.cancel($scope.jobId).then(function (status, error) {
                    if (error) {
                        PopupDialog.error(null, error, flushAll);
                        return;
                    }
                    flushAll(status);
                });
            };

            function getEstimateTime() {
                mdb.getDebugJobsList().then(function (list) {
                    var timeMax;
                    var timeMin;
                    function averageTime(t1, t2) {
                        return (new Date(t1).getTime() + new Date(t2).getTime()) / 2;
                    }

                    function processTime(t1, t2) {
                        return (new Date(t1).getTime() - new Date(t2).getTime());
                    }

                    list.forEach(function (job) {
                        if ((job.dateEnd && timeMax < processTime(job.dateEnd, job.date)) || (job.dateEnd && !timeMax)) {
                            timeMax = processTime(job.dateEnd, job.date);
                        }
                        if ((job.dateEnd && timeMin > processTime(job.dateEnd, job.date)) || (job.dateEnd && !timeMin)) {
                            timeMin = processTime(job.dateEnd, job.date);
                        }
                    });

                    var time = averageTime(timeMax, timeMin) / 1000 || 0;
                    $scope.estimateTime = Math.round((time /= 60) % 60);
                });
            }

            if ($scope.jobId) {
                $scope.processing = false;
                $scope.loading = true;
                var getStatus = function () {
                    mdb.getJobFromList($scope.jobId).then(function (job) {
                        if (job.status === 'Processed') {
                            mdb.getDebugJob($scope.jobId).then(processResult, function (error) {
                                PopupDialog.error(null, error, flushAll('Failed'));
                            });
                        } else {
                            $scope.inputFile = [{filePath: job.coreFile}];
                            $scope.status = job.status;
                            var checkStatus = {Cancelled: false, Failed: false, Processing: true, Parsing: true};
                            if (checkStatus[job.status]) {
                                setTimeout(getStatus, 10000);
                            } else {
                                flushAll(job.status);
                            }
                        }
                    });
                };
                getStatus();
            }

            getEstimateTime();
            $scope.clickSignup = function () {
                $location.path('/support/cloud');
            };

            $scope.$watch('jobId', function (val) {
                if (!val || val === 'create') {
                    return;
                }
                $location.path('/mdb' + (val ? '/' + val : ''), true);
            });

            var getSupportStatus = function () {
                Support.support(function (error, supportPackages) {
                    if (error) {
                        PopupDialog.error(null, error);
                        return;
                    }
                    supportPackages.forEach(function (packages) {
                        if (packages.name === 'node') {
                            var supportStatus;
                            packages.packageHolders.forEach(function (nodePackage) {
                                if (nodePackage.active) {
                                    supportStatus = nodePackage.title;
                                }
                            });
                            $scope.supportStatus = supportStatus || 'Not signed up';
                        }
                    });
                });
            };

            $scope.selectFile = function () {
                var filesQuantity = $scope.inputFile.length;
                if (filesQuantity > 1) {
                    $scope.inputFile.splice(0, filesQuantity - 1);
                }
            };
            getSupportStatus();
        }
    ]);
}(window.JP.getModule('mdb')));