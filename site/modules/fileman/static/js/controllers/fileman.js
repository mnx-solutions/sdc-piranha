//noinspection JSLint
(function (app, ng) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        'localization',
        'requestContext',
        'fileman',
        '$timeout',
        'PopupDialog',
        'Account',
        '$qe',

        function ($scope, localization, requestContext, fileman, $timeout, PopupDialog, Account, $qe) {
            //TODO: Move fileman to storage module
            localization.bind('fileman', $scope);
            requestContext.setUpRenderContext('fileman.index', $scope);
            fileman.setScope($scope);

            $scope.loadingFolder = false;
            $scope.refreshingFolder = false;
            $scope.loading = true;
            $scope.filesTree = {};
            var rootPath = '/';
            var defaultPath = {path: 'public', parent: '/'};
            var previousFullPath;
            var fullPath;
            var lastSelectedFile = [];

            var clearSelectedFiles = function () {
                lastSelectedFile[0].active = false;
                lastSelectedFile = [];
            }

            $scope.getColumnClass = function (index) {
                return index === 0 ? 'general-column' : 'finder-column';
            };

            $scope.downloadFile = function () {
                if (lastSelectedFile.length && lastSelectedFile[0].active) {
                    fileman.get($scope.currentPath + '/' + lastSelectedFile[0].name);
                    clearSelectedFiles();
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
                            'No file selected.'
                        ),
                        function () {}
                    );
                }
            };

            $scope.createFilesTree = function (userAction, callback) {
                fileman.ls($scope.currentPath, function (error, result) {
                    $scope.files = result.__read();
                    if ($scope.filesTree[$scope.currentPath] !== $scope.files) {
                        $scope.filesTree[$scope.currentPath] = $scope.files;
                    }
                    $scope.loadingFolder = false;
                    $scope.loading = false;
                    $scope.refreshingFolder = false;
                    if (callback) {
                        callback(error, result);
                    }
                    if (rootPath !== $scope.currentPath && userAction) {
                        $scope.userConfig.$load(function (err, config) {
                            config.path = fullPath;
                            config.dirty = true;
                            config.$save();
                        });
                    }
                });
            }


            $scope.setCurrentPath = function setCurrentPath(obj, userAction, callback) {
                fullPath = obj === rootPath ? obj : ('/' + obj.parent.split('/').slice(2).join('/') + '/' + obj.path);

                var scrollContent = ng.element('.folder-container-sub');
                var fileBoxWidth = ng.element('.finder-column .files-box').width() + 1;
                $timeout(function () {
                    scrollContent.scrollLeft(scrollContent.scrollLeft() + fileBoxWidth);
                })

                if ($scope.loadingFolder) {
                    return;
                }
                if (obj && obj.type && obj.type !== 'directory') {
                    if (lastSelectedFile.length) {
                        clearSelectedFiles();
                    }
                    obj.active = true;
                    lastSelectedFile.push(obj);
                    return;
                }
                if (fullPath === previousFullPath && userAction) {
                    return;
                }
                previousFullPath = fullPath;

                $scope.loadingFolder = true;
                if (!userAction) {
                    fullPath = (obj && (obj.full || obj.name)) || fullPath || $scope.currentPath || '/';
                    $scope.currentPath = $scope.currentPath || fullPath;
                } else {
                    $scope.currentPath = fullPath;
                }
                if (fullPath[0] === '/') {
                    $scope.currentPath = fullPath;
                } else {
                    $scope.currentPath += $scope.currentPath.substr(-1) !== '/' ? '/' + fullPath : fullPath;
                }

                $scope.splittedCurrentPath = $scope.currentPath.split(/\/([^/]+)/)
                    .filter(function (e) {
                        return !!e;
                    });

                if ($scope.splittedCurrentPath[0] !== '/') {
                    $scope.splittedCurrentPath.unshift('/');
                }

                $scope.splittedCurrentPath = $scope.splittedCurrentPath.map(function (e, index, array) {
                    return {
                        name: e,
                        full: array.slice(0, index + 1).join('/').substr(1)
                    };
                });

                var tmpFilesTree = {};
                var i;

                for (var index in $scope.filesTree) {
                    if ($scope.filesTree.hasOwnProperty(index)) {
                        $scope.filesTree[index].forEach(function (el) {
                            el.active = false;
                            for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                                if ((index + '/' + el.name).replace(/\/+/, '/') === $scope.splittedCurrentPath[i].full.replace(/\/+/, '/')) {
                                    el.active = true;
                                }
                            }
                        });
                    }
                    for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                        var splitFullPath = $scope.splittedCurrentPath[i].full;
                        if (index === '/' + splitFullPath || index === splitFullPath) {
                            tmpFilesTree[splitFullPath] = $scope.filesTree[index];
                        }
                    }
                }
                $scope.filesTree = tmpFilesTree;
                $scope.createFilesTree(userAction, callback);
            };

            $scope.addFile = function () {
                //TODO: Check if implementation needed
                return false;
            };

            $scope.drawFileMan = function () {
                $scope.userConfig = Account.getUserConfig().$child('fileman');
                $scope.userConfig.$load(function (err, config) {
                    var obj;
                    var loadedPath;
                    var filteredPath = [];
                    var parentPath = '/';

                    if (config && config.path) {
                        obj = config.path;
                        loadedPath = obj.split(/\/([^/]+)/);
                        for (var i = 0; i < loadedPath.length; i++) {
                            if (loadedPath[i] !== "") {
                                if (loadedPath[i] !== "/") {
                                    filteredPath.push({path: loadedPath[i], parent: parentPath});
                                    parentPath += '/' + loadedPath[i];
                                }
                            }
                        }
                    }

                    if (!filteredPath.length) {
                        filteredPath.push(defaultPath);
                    }

                    var setCurrentPathPromise = $qe.denodeify($scope.setCurrentPath);
                    // Navigate up to saved path from root
                    $qe.series(filteredPath.map(function (newPath) {
                        return function () { return setCurrentPathPromise(newPath, false); };
                    }), setCurrentPathPromise(rootPath, false));
                });
            }

            if (!$scope.currentPath) {
                $scope.drawFileMan();
            }

            $scope.construction = function () {
                PopupDialog.message(
                    localization.translate(
                        $scope,
                        null,
                        'Message'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Construction works.'
                    ),
                    function () {}
                );
            };

            $scope.$on('uploadReady', function () {
                $scope.createFilesTree();
            });

            $scope.$on('uploadStart', function () {
                $scope.refreshingFolder = true;
            });
        }
    ]);
})(window.JP.getModule('fileman'), angular);