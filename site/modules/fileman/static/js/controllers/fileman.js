//noinspection JSLint
(function (app, ng) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        '$location',
        'localization',
        'requestContext',
        'fileman',
        '$timeout',
        'PopupDialog',
        'Account',
        '$qe',
        '$q',

        function ($scope, $location,localization, requestContext, fileman, $timeout, PopupDialog, Account, $qe, $q) {
            //TODO: Move fileman to storage module
            localization.bind('fileman', $scope);
            requestContext.setUpRenderContext('fileman.index', $scope);
            fileman.setScope($scope);

            $scope.loadingFolder = false;
            $scope.refreshingFolder = false;
            $scope.loading = true;
            $scope.filesTree = {};
            $scope.userConfig = Account.getUserConfig().$child('fileman');

            var rootPath = '/';
            var defaultPath = {path: 'public', parent: '/'};
            var previousFullPath;
            var lastSelectedFile = null;
            var lastSelectedActive = false;

            var getObjectPath = function (obj) {
                return typeof (obj) === 'string' ? obj : ('/' + obj.parent.split('/').splice(2).join('/') + '/' + obj.path).replace(/\/+/g, '/');
            };

            $scope.getColumnClass = function (index) {
                return index === 0 ? 'general-column' : 'finder-column';
            };

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


            function getCurrentDirectory() {
                if (!lastSelectedFile) {
                    return '/public';
                }
                return getObjectPath({parent: lastSelectedFile.parent, path: lastSelectedFile.type === 'directory' ? lastSelectedFile.path : ''});
            }

            function getLastSelectedObj(path) {
                var rawPath = path.split('/');
                var parentPath = rawPath.slice(0, -1).join('/');
                var objName = rawPath[rawPath.length - 1];
                var lastSelectedObject = null;

                if ($scope.filesTree[parentPath]) {
                    lastSelectedObject = $scope.filesTree[parentPath].filter(function (obj) {
                        if (obj.name === objName) {
                            return obj;
                        }
                    })[0];
                }

                return lastSelectedObject || path;
            }

            function getAbsolutePath(path) {
                return '/' + path.split('/').slice(2).join('/');
            }

            $scope.downloadFile = function () {
                if (lastSelectedFile && lastSelectedActive && lastSelectedFile.type === 'object') {
                    fileman.get($scope.currentPath);
                } else {
                    showPopupDialog('message', 'Message', 'No file selected.');
                }
            };

            $scope.createFolder = function () {
                var createFolderModalCtrl = function ($scope, dialog) {
                    $scope.title = 'Create folder';

                    $scope.close = function (res) {
                        dialog.close(res);
                    };

                    $scope.createFolder = function () {
                        $scope.close({
                            folderName: $scope.folderName
                        });
                    };
                };

                var opts = {
                    templateUrl: 'fileman/static/partials/newFolderForm.html',
                    openCtrl: createFolderModalCtrl
                };

                PopupDialog.custom(
                    opts,
                    function (data) {
                        if (data) {
                            var files = null;
                            var parentPath = null;
                            $scope.refreshingFolder = true;

                            if (lastSelectedFile.type === 'object') {
                                parentPath = $scope.currentPath.split('/').slice(0, -1).join('/');
                                files = $scope.filesTree[parentPath] || [];
                            } else {
                                files = $scope.files;
                            }

                            var itemExists = files.filter(function (item) {
                                return item.name === data.folderName;
                            });

                            if (itemExists.length > 0) {
                                itemExists = itemExists[0];
                                var introText = itemExists.type === 'object' ? 'File' : 'Folder';
                                showPopupDialog('error', 'Message', introText + ' "' + data.folderName + '" already exists.');
                                $scope.refreshingFolder = false;
                            } else {
                                fileman.mkdir(getCurrentDirectory() + '/' + data.folderName, function (error) {
                                    if (error) {
                                        return PopupDialog.errorObj(error);
                                    }
                                    $scope.refreshingFolder = true;
                                    $scope.createFilesTree(true, parentPath);
                                });
                            }
                        }
                    }
                );
            };

            $scope.deleteFile = function () {
                if (!lastSelectedFile) {
                    return false;
                }

                var file = lastSelectedFile;
                var path = getObjectPath(file);
                var method = (file.type === 'object') ? 'unlink' : 'rmr';

                if (path === '/public' && file.name === 'public') {
                    return showPopupDialog('error', 'Message', 'You can not delete public folder');
                }
                PopupDialog.confirm(
                    null,
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete "{{name}}"?',
                        {
                            name: file.name
                        }
                    ),
                    function () {
                        $scope.refreshingFolder = true;
                        lastSelectedFile = null;
                        fileman[method](path, function (error) {
                            if (error) {
                                return showPopupDialog('error', 'Message', error.message, function () {
                                    $scope.refreshingFolder = false;
                                });
                            }
                            delete $scope.filesTree[path];
                            $scope.setCurrentPath(getAbsolutePath(file.parent), true);
                        });
                    }
                );
            };
            $scope.getInfo = function () {
                if (!lastSelectedFile) {
                    return false;
                }

                var path = getObjectPath(lastSelectedFile);

                fileman.info(path, function (error, info) {
                    if (error) {
                        return showPopupDialog('error', 'Error', error);
                    }

                    var infoModalCtrl = function ($scope, dialog) {
                        $scope.info = info.__read();
                        $scope.title = $scope.info.name + " description";
                        $scope.info.type = ($scope.info.extension === 'directory') ? 'directory' : $scope.info.type;

                        $scope.close = function (res) {
                            dialog.close(res);
                        };
                    };

                    PopupDialog.custom({
                        templateUrl: 'fileman/static/partials/info.html',
                        openCtrl: infoModalCtrl
                    });
                });
            };

            $scope.createFilesTree = function (userAction, path, callback, attempt) {
                path = path || $scope.currentPath;
                var lsCallback = function (error, result) {
                    $scope.files = result.__read();
                    if (!error && ($scope.filesTree[path] !== $scope.files)) {
                        $scope.filesTree[path] = $scope.files;
                    }
                    $scope.loadingFolder = false;
                    $scope.loading = false;
                    $scope.refreshingFolder = false;
                    if (callback) {
                        callback(error, result);
                    }
                    if (rootPath !== path && userAction && $scope.userConfig.loaded()) {
                        var config = $scope.userConfig.$child('fileman');
                        config.path = path;
                        config.dirty(true);
                        config.$save();
                    }
                };
                fileman.ls(path, lsCallback);
            };

            $scope.setCurrentPath = function setCurrentPath(obj, userAction, callback) {
                if (typeof obj === 'string') {
                    obj = getLastSelectedObj(obj);
                }

                var fullPath = obj === rootPath ? obj : getObjectPath(obj);
                var scrollContent = ng.element('.folder-container-sub');
                var fileBoxWidth = ng.element('.finder-column .files-box').width() + 1;
                $timeout(function () {
                    scrollContent.scrollLeft(scrollContent.scrollLeft() + fileBoxWidth);
                });

                if ($scope.loadingFolder) {
                    return;
                }
                if (lastSelectedFile) {
                    lastSelectedActive = false;
                }

                lastSelectedFile = obj;
                lastSelectedActive = true;

                previousFullPath = fullPath;
                if ($scope.files) {
                    $scope.switchLoaderPosition = $scope.files.indexOf(obj) === -1;
                }
                $scope.loadingFolder = !obj.type || obj.type === 'directory';
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

                if (obj.type) {
                    $scope.uploadPath = obj.type === 'object' ? getAbsolutePath(obj.parent) : $scope.currentPath;
                }

                $scope.splittedCurrentPath = $scope.currentPath.split(/\//)
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

                function setActiveElementInPath(index) {
                    return function (el) {
                        el.active = $scope.splittedCurrentPath.some(function (item) {
                            return (index + '/' + el.name).replace(/\/+/, '/') === item.full;
                        });
                    };
                }

                for (var index in $scope.filesTree) {
                    if ($scope.filesTree.hasOwnProperty(index)) {
                        $scope.filesTree[index].forEach(setActiveElementInPath(index));

                        for (var i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                            var splitFullPath = $scope.splittedCurrentPath[i].full;
                            if (index === '/' + splitFullPath || index === splitFullPath) {
                                tmpFilesTree[splitFullPath] = $scope.filesTree[index];
                            }
                        }
                    }
                }
                $scope.filesTree = tmpFilesTree;
                if (typeof (obj) === 'string' || obj.type === 'directory') {
                    $scope.createFilesTree(userAction, null, callback);
                } else {
                    if (rootPath !== $scope.currentPath && userAction && $scope.userConfig.loaded()) {
                        var config = $scope.userConfig.$child('fileman');
                        config.path = $scope.currentPath;
                        config.dirty(true);
                        config.$save();
                    }
                }
            };

            $scope.drawFileMan = function () {
                $scope.userConfig.$load(function (err, config) {
                    var obj;
                    var loadedPath;
                    var filteredPath = [];
                    var parentPath = '/';

                    if (config && config.path) {
                        obj = config.path;
                        loadedPath = obj.split(/\//);
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
                    var notResolvedPath = false;
                    // Navigate up to saved path from root

                    $qe.series(filteredPath.map(function (newPath) {
                        return function (args) {
                            var result = args[0].__read();
                            var item = Array.isArray(result) && result.filter(function (el) {
                                return el.path === newPath.path;
                            })[0];
                            if (notResolvedPath || !item) {
                                notResolvedPath = true;
                                var defer = $qe.defer();
                                defer.resolve(args);
                                return defer.promise;
                            }
                            return setCurrentPathPromise(item || newPath, false);
                        };
                    }), setCurrentPathPromise(rootPath, false)).then(
                            function () {
                            },
                            function (err) {
                                if (err) {
                                    return PopupDialog.errorObj(err);
                                }

                            });
                });
            };

            $scope.completeAccount = function () {
                var submitBillingInfo = {
                    btnTitle: 'Submit and Access Manta',
                    appendPopupMessage: 'Manta access will now be granted.'
                };
                Account.checkProvisioning(submitBillingInfo, $scope.drawFileMan.bind($scope), angular.noop, function (isSuccess) {
                    $location.path(isSuccess ? '/manta/files' : '/manta/intro');
                });
            };

            Account.getAccount().then(function (account) {
                $scope.provisionEnabled = account.provisionEnabled;
                if ($scope.provisionEnabled) {
                    $scope.drawFileMan();
                } else {
                    $scope.loading = false;
                }
            });

            $scope.construction = function () {
                showPopupDialog('message', 'Message', 'Construction works.');
            };

            $scope.$on('uploadReady', function (scope, userAction, path) {
                $scope.createFilesTree(userAction, path);
            });

            $scope.$on('uploadStart', function () {
                $scope.refreshingFolder = true;
            });
        }
    ]);
})(window.JP.getModule('fileman'), angular);