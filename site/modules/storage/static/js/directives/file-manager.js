'use strict';

(function (app, ng) {
    app.directive('fileManager', ['Account', 'localization', 'PopupDialog', 'fileman', '$timeout', '$qe', 'util',
            'Storage', '$location', 'rbac.Service', 'notification', '$rootScope', 'http', '$http',
        function (Account, localization, PopupDialog, fileman, $timeout, $qe, util,
                  Storage, $location, RbacService, notification, $rootScope, http, $http) {
        return {
            restrict: 'EA',
            scope: {
                showControls: '=',
                currentPath: '=',
                popup: '='
            },
            templateUrl: 'storage/static/partials/file-manager.html',
            link: function (scope) {
                scope.loadingFolder = false;
                scope.refreshingFolder = false;
                scope.loading = true;
                scope.infoDialogOpening = false;
                scope.filesTree = {};
                scope.uploads = {};

                scope.uploadProgresses = function () {
                    var progresses = {};

                    Object.keys(scope.uploads).forEach(function (id) {
                        progresses[id] = scope.uploads[id].progress;
                    });

                    return progresses;
                };

                Account.getUserConfig('fileman', function (config) {
                    scope.userConfig = config;
                });
                scope.rbacEnabled = $rootScope.features.rbac === 'enabled';

                var rootPath = '/';
                var DEFAULT_PATH = {path: 'public', parent: '/'};
                var FILE_TYPE = 'object';
                var lastSelectedFile = null;
                var lastSelectedActive = false;
                var serverUploadPollIntervals = [];

                var PathUtil = {
                    getAbsolute: function (path) {
                        return '/' + path.split('/').slice(2).join('/');
                    },
                    getObject: function (obj) {
                        return typeof obj === 'string' ? obj : (this.getAbsolute(obj.parent) + '/' + obj.path).replace(/\/+/g, '/');
                    },
                    getParent: function (path) {
                        return path.split('/').slice(0, -1).join('/');
                    },
                    getSplitted: function (path) {
                        var splittedPath = [];
                        if (path) {
                            var parentPath = '';
                            path.split(/\//).forEach(function (loadedPath) {
                                if (loadedPath !== '' && loadedPath !== '/') {
                                    splittedPath.push({path: loadedPath, parent: parentPath || '/'});
                                    parentPath += '/' + loadedPath;
                                }
                            });
                        }
                        return splittedPath.length ? splittedPath : [DEFAULT_PATH];
                    }
                };

                scope.getColumnClass = function (index) {
                    return index === 0 ? 'general-column' : 'finder-column';
                };

                var showPopupDialog = function (level, title, message, callback) {
                    if (level === 'error') {
                        scope.loading = false;
                    }
                    return PopupDialog[level](
                        title ? localization.translate(
                            scope,
                            null,
                            title
                        ) : null,
                        message ? localization.translate(
                            scope,
                            null,
                            message
                        ) : null,
                        callback
                    );
                };

                var getCurrentDirectory = function () {
                    if (!lastSelectedFile) {
                        return '/public';
                    }
                    return PathUtil.getObject({parent: lastSelectedFile.parent, path: lastSelectedFile.type === 'directory' ? lastSelectedFile.path : ''});
                };

                var getLastSelectedObj = function (path) {
                    var rawPath = path.split('/');
                    var parentPath = PathUtil.getParent(path);
                    var objName = rawPath[rawPath.length - 1];
                    var lastSelectedObject = null;

                    if (scope.filesTree[parentPath]) {
                        lastSelectedObject = scope.filesTree[parentPath].filter(function (obj) {
                            return obj.name === objName;
                        })[0];
                    }

                    return lastSelectedObject || path;
                };

                scope.downloadFile = function () {
                    if (lastSelectedFile && lastSelectedActive && lastSelectedFile.type === FILE_TYPE) {
                        fileman.getFile(scope.currentPath, function (error) {
                            if (error) {
                                showPopupDialog('error', 'Message', error);
                                return;
                            }
                            fileman.get(scope.currentPath);
                        });
                    } else {
                        showPopupDialog('message', 'Message', 'No file selected.');
                    }
                };

                var createFolderModalCallback = function (data) {
                    if (!data) {
                        return;
                    }
                    var files = null;
                    var parentPath = null;
                    scope.refreshingFolder = true;
                    if (lastSelectedFile && lastSelectedFile.type === FILE_TYPE) {
                        parentPath = PathUtil.getParent(scope.currentPath);
                        files = scope.filesTree[parentPath] || [];
                    } else {
                        files = scope.files;
                    }

                    var existingItem = files.find(function (item) {
                        return item.name === data.folderName;
                    });

                    if (existingItem) {
                        var introText = existingItem.type === 'object' ? 'File' : 'Folder';
                        showPopupDialog('error', 'Message', introText + ' "' + data.folderName + '" already exists.');
                        scope.refreshingFolder = false;
                    } else {
                        var directoryPath = getCurrentDirectory();
                        if (!lastSelectedFile) {
                            directoryPath = parentPath = PathUtil.getParent(scope.currentPath);
                        }
                        fileman.mkdir(directoryPath + '/' + data.folderName, function (error) {
                            if (error) {
                                scope.refreshingFolder = false;
                                return;
                            }
                            return scope.createFilesTree(true, parentPath);
                        });
                    }
                };

                scope.createFolder = function () {
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
                        templateUrl: 'storage/static/partials/newFolderForm.html',
                        openCtrl: createFolderModalCtrl
                    };

                    PopupDialog.custom(opts, createFolderModalCallback);
                };

                var deleteFileAction = function (file, path, method) {
                    scope.refreshingFolder = true;
                    lastSelectedFile = null;
                    fileman[method](path, function (error) {
                        if (error) {
                            return showPopupDialog('error', 'Message', error.message || error, function () {
                                scope.refreshingFolder = false;
                            });
                        }
                        delete scope.filesTree[path];
                        return scope.setCurrentPath(PathUtil.getAbsolute(file.parent), 'delete');
                    });
                };

                scope.deleteFile = function () {
                    if (!lastSelectedFile) {
                        return false;
                    }

                    var file = lastSelectedFile;
                    var path = PathUtil.getObject(file);
                    var method = file.type === FILE_TYPE ? 'unlink' : 'rmr';

                    if (file.type === 'directory' && file.parent.indexOf('/', 1) === -1) {
                        var message = 'System folder "' + file.name + '" cannot be deleted.';
                        return showPopupDialog('error', 'Message', message);
                    }

                    return PopupDialog.confirm(null,
                        localization.translate(
                            scope,
                            null,
                            'Are you sure you want to delete "{{name}}"?',
                            {
                                name: file.name
                            }
                        ), function () {
                            deleteFileAction(file, path, method);
                        });
                };

                scope.getInfo = function () {
                    if (!lastSelectedFile) {
                        return false;
                    }
                    scope.infoDialogOpening = true;
                    var path = PathUtil.getObject(lastSelectedFile);

                    return fileman.info(path, function (error, info) {
                        if (error) {
                            scope.infoDialogOpening = false;
                            return showPopupDialog('error', 'Error', error);
                        }
                        scope.infoDialogOpening = false;
                        var infoModalCtrl = function ($scope, dialog) {
                            $scope.info = info.__read();
                            $scope.currentPath = info.data.path;
                            $scope.fileSize = util.getReadableFileSizeString($scope.info.size, 1000);

                            if ($scope.info.extension === 'directory') {
                                $scope.title = 'Folder Information';
                                $scope.info.type = 'folder';
                            } else {
                                $scope.title = 'File Information';
                            }

                            $scope.close = function (res) {
                                dialog.close(res);
                            };
                        };

                        return PopupDialog.custom({
                            templateUrl: 'storage/static/partials/info.html',
                            openCtrl: infoModalCtrl
                        });
                    });
                };

                var getRoles = function ($scope, path) {
                    $qe.all([
                        RbacService.listRoles(),
                        RbacService.listPolicies(),
                        fileman.getRoles(path, {}).promise
                    ]).then(function (results) {
                        var rbacRoles = results[0] || [];
                        var rbacPolicies = results[1] || [];
                        var resourceRoles = results[2] || [];
                        var availableRoles = rbacRoles.map(function (role) {
                            role.value = role.id;
                            return role;
                        }).sort(function (a, b) {
                            return a.name.localeCompare(b.name);
                        });
                        $scope.assignedRoles = availableRoles.filter(function (role) {
                            return resourceRoles.indexOf(role.name) !== -1;
                        });
                        $scope.resourceRoles = $scope.assignedRoles.map(function (role) {
                            return role.name;
                        });
                        $scope.roles = availableRoles.filter(function (availableRole) {
                            var rulesForRole = availableRole.policies.map(function (policyName) {
                                var policyObj = rbacPolicies.find(function (policy) {
                                    return policy.name === policyName;
                                });
                                return policyObj ? policyObj.rules.join() : '';
                            }).join().toLowerCase();
                            var isRulePresent = function (permission) {
                                return rulesForRole.indexOf(permission) !== -1;
                            };
                            var hasFilePermissions = ['getobject', 'putobject', 'deleteobject'].some(isRulePresent);
                            var hasDirPermissions = ['getdirectory', 'putdirectory', 'deletedirectory'].some(isRulePresent);
                            return $scope.isDirectory && (hasDirPermissions || hasFilePermissions) ||
                                !$scope.isDirectory && hasFilePermissions ||
                                $scope.assignedRoles.indexOf(availableRole) !== -1;
                        });
                        $scope.loading = false;
                    });
                };

                scope.roleTag = function () {
                    if (!lastSelectedFile) {
                        return;
                    }
                    var path = PathUtil.getObject(lastSelectedFile);

                    var roleTagCtrl = function ($scope, dialog) {
                        $scope.recursive = false;
                        $scope.loading = true;
                        $scope.isDirectory = lastSelectedFile.type === 'directory';
                        $scope.isNotEmptyDirectory = $scope.isDirectory && scope.files.length !== 0;
                        getRoles($scope, path);

                        $scope.save = function () {
                            if (!$scope.assignedRoles) {
                                return $scope.close();
                            }
                            var assignedRoles = $scope.assignedRoles.map(function (role) {
                                return role.name;
                            });
                            if (assignedRoles > $scope.resourceRoles || assignedRoles < $scope.resourceRoles) {
                                fileman.setRoles(path, {roles: assignedRoles, recursive: $scope.recursive}, function (setErr) {
                                    if (setErr) {
                                        notification.error('Applying role tags resulted in error: ' + setErr);
                                        return;
                                    }
                                    notification.success('Role tags successfully applied.');
                                });
                            }
                            return $scope.close();
                        };

                        $scope.close = function () {
                            dialog.close();
                        };
                    };

                    return PopupDialog.custom({
                        templateUrl: 'storage/static/partials/role-tag.html',
                        openCtrl: roleTagCtrl
                    });
                };

                var checkErrorRolesResource = function (error) {
                    var errorMessage = 'None of your active roles are present on the resource';
                    scope.errorRolesResource = typeof error === 'string' && error.indexOf(errorMessage) !== -1 && scope.popup;
                };

                scope.createFilesTree = function (userAction, path, callback) {
                    path = path || scope.currentPath;
                    fileman.ls(path, function (error, result) {
                        scope.loadingFolder = false;
                        scope.loading = false;
                        scope.refreshingFolder = false;
                        scope.errorRolesResource = false;
                        if (error) {
                            checkErrorRolesResource(error);
                            if (!scope.errorRolesResource) {
                                return showPopupDialog('error', 'Error', error);
                            }
                            return;
                        }

                        scope.files = result.__read();
                        if (!error && (scope.filesTree[path] !== scope.files)) {
                            scope.filesTree[path] = scope.files;
                        }

                        if (callback) {
                            callback(error, result);
                        }
                        if (rootPath !== path && userAction && scope.userConfig) {
                            fileman.saveFilemanConfig(path);
                        }
                        return null;
                    });
                };

                var setSplittedCurrentPath = function () {
                    scope.splittedCurrentPath = scope.currentPath.split(/\//).filter(function (pathElement) {
                        return !!pathElement;
                    });
                    if (scope.splittedCurrentPath[0] !== '/') {
                        scope.splittedCurrentPath.unshift('/');
                    }
                    scope.splittedCurrentPath = scope.splittedCurrentPath.map(function (pathElement, pathIndex, array) {
                        return {
                            name: pathElement,
                            full: array.slice(0, pathIndex + 1).join('/').substr(1)
                        };
                    });
                };

                var getCurrentFilesTree = function () {
                    var currentFilesTree = {};
                    var setActiveElementInPath = function (elementIndex) {
                        return function (el) {
                            el.active = scope.splittedCurrentPath.some(function (item) {
                                return (elementIndex + '/' + el.name).replace(/\/+/, '/') === item.full;
                            });
                        };
                    };
                    Object.keys(scope.filesTree).forEach(function (key) {
                        scope.filesTree[key].forEach(setActiveElementInPath(key));
                        scope.splittedCurrentPath.forEach(function (pathElement) {
                            var elementFullPath = pathElement.full;
                            if (key === '/' + elementFullPath || key === elementFullPath) {
                                currentFilesTree[elementFullPath] = scope.filesTree[key];
                            }
                        });
                    });
                    return currentFilesTree;
                };

                var saveFilemanConfig = function (userAction) {
                    fileman.info(scope.currentPath, function (error) {
                        scope.errorRolesResource = false;
                        if (error) {
                            checkErrorRolesResource(error);
                            if (!scope.errorRolesResource) {
                                return showPopupDialog('error', 'Error', error);
                            }
                            return;
                        }
                        if (rootPath !== scope.currentPath && userAction && scope.userConfig) {
                            fileman.saveFilemanConfig(scope.currentPath);
                        }
                    });
                };

                scope.setCurrentPath = function (obj, userAction, callback) {
                    if (typeof obj === 'string') {
                        obj = getLastSelectedObj(obj);
                    }

                    var fullPath = obj === rootPath ? obj : PathUtil.getObject(obj);
                    var scrollContent = ng.element('.folder-container-sub');
                    var fileBoxWidth = ng.element('.finder-column .files-box').width() + 1;
                    $timeout(function () {
                        scrollContent.scrollLeft(scrollContent.scrollLeft() + fileBoxWidth);
                    });

                    if (scope.loadingFolder || scope.currentPath === fullPath) {
                        return;
                    }
                    scope.currentSelectedObject = obj;
                    if (lastSelectedFile) {
                        lastSelectedActive = false;
                    }

                    if (scope.files) {
                        scope.switchLoaderPosition = scope.files.indexOf(obj) === -1 && lastSelectedFile &&
                            lastSelectedFile.type !== FILE_TYPE || fullPath.split(/\//).length === 2;
                    }

                    lastSelectedFile = obj;
                    lastSelectedActive = true;

                    if ((!obj.type || obj.type === 'directory') && userAction !== 'delete') {
                        scope.loadingFolder = true;
                        if (fullPath.indexOf(scope.currentPath) === -1 && scope.filesTree[scope.currentPath]) {
                            scope.filesTree[fullPath] = [];
                        }
                    }

                    if (!userAction) {
                        fullPath = (obj && (obj.full || obj.name)) || fullPath || scope.currentPath || '/';
                        scope.currentPath = scope.currentPath || fullPath;
                    } else {
                        scope.currentPath = fullPath;
                    }
                    if (fullPath[0] === '/') {
                        scope.currentPath = fullPath;
                    } else {
                        scope.currentPath += scope.currentPath.substr(-1) !== '/' ? '/' + fullPath : fullPath;
                    }

                    if (obj.type) {
                        scope.uploadPath = obj.type === FILE_TYPE ? PathUtil.getAbsolute(obj.parent) : scope.currentPath;
                    }
                    setSplittedCurrentPath();
                    scope.filesTree = getCurrentFilesTree();
                    if (typeof obj === 'string' || obj.type === 'directory') {
                        scope.createFilesTree(userAction, null, callback);
                    } else {
                        scope.refreshingFolder = false;
                        saveFilemanConfig(userAction);
                    }
                };

                scope.drawFileMan = function () {
                    var configPath = scope.userConfig && scope.userConfig.path;
                    var splittedPath = PathUtil.getSplitted(configPath);
                    var setCurrentPathPromise = $qe.denodeify(scope.setCurrentPath);
                    var isPathResolved = true;
                    // Navigate up to saved path from root

                    $qe.series(splittedPath.map(function (newPath) {
                        return function (args) {
                            var result = args[0].__read();
                            var item = Array.isArray(result) && result.filter(function (el) {
                                return el.path === newPath.path;
                            })[0];
                            if (isPathResolved && item) {
                                return setCurrentPathPromise(item || newPath, false);
                            }
                            isPathResolved = false;
                            var defer = $qe.defer();
                            defer.resolve(args);
                            return defer.promise;
                        };
                    }), setCurrentPathPromise(rootPath, false));
                };

                scope.completeAccount = function () {
                    var submitBillingInfo = {
                        btnTitle: 'Submit and Access Manta',
                        appendPopupMessage: 'Manta access will now be granted.'
                    };
                    Account.checkProvisioning(submitBillingInfo, null, Storage.getAfterBillingHandler('/manta/files'), false);
                };

                Account.getAccount().then(function (account) {
                    scope.provisionEnabled = account.provisionEnabled;
                    if (scope.provisionEnabled) {
                        Storage.getAfterBillingHandler(null, scope.drawFileMan)(true);
                    } else {
                        scope.loading = false;
                    }
                });

                scope.construction = function () {
                    showPopupDialog('message', 'Message', 'Construction works.');
                };

                var createUploadTitle = function (progress) {
                    var currentProgress = scope.uploads[progress.id].progress;
                    var total = util.getReadableFileSizeString(progress.total, 1000);
                    scope.uploads[progress.id].title = util.getReadableFileSizeString(currentProgress.loaded, 1000) + ' of ' + total +
                        ' -> server </br>' +
                        util.getReadableFileSizeString(currentProgress.serverLoaded, 1000) + ' of ' + total +
                        ' -> Manta';
                };

                var clearProgress = function (progressId, path) {
                    $timeout(function () {
                        delete scope.uploads[progressId];
                        if (Object.keys(scope.uploads).length === 0) {
                            scope.refreshingProgress = false;
                            scope.createFilesTree(true, path);
                        }
                    });
                };

                var pollServerUploadProgress = function (emitter, data) {
                    var progress = data.progress;
                    var stopPolling = function () {
                        clearInterval(serverUploadPollIntervals[progress.id]);
                        clearProgress(progress.id, progress.path);
                        if (scope.uploads[progress.id]) {
                            scope.uploads[progress.id].progress.clientDone = true;
                        }
                        emitter.$emit(fileman.UPLOAD_EVENTS.complete, data);
                    };

                    Storage.getServerUploadProgress(progress.formId, function (error, loadedProgress) {
                        if (error) {
                            stopPolling();
                            return showPopupDialog('error', 'Error', error);
                        }

                        loadedProgress = loadedProgress.__read();

                        if (Array.isArray(loadedProgress) || !scope.uploads[progress.id]) {
                            stopPolling();
                        } else {
                            scope.uploads[progress.id].progress.serverLoaded = loadedProgress;
                            createUploadTitle(progress);
                        }
                    });
                };

                function uploadProgressListener(emitter) {
                    emitter.$on(fileman.UPLOAD_EVENTS.error, function ($scope, id, path) {
                        clearProgress(id, path);
                    });

                    emitter.$on(fileman.UPLOAD_EVENTS.ready, function ($scope, id) {
                        if (scope.uploads[id]) {
                            scope.uploads[id].progress.clientDone = true;
                        }
                    });
                    emitter.$on(fileman.UPLOAD_EVENTS.progress, function (event, data) {
                        var progress = data.progress;
                        data.emitter = emitter;
                        scope.uploads[progress.id] = data;
                        progress.filePath = progress.path;
                        createUploadTitle(progress);
                        if (!serverUploadPollIntervals[progress.id]) {
                            pollServerUploadProgress(emitter, data);
                            serverUploadPollIntervals[progress.id] = setInterval(function () {
                                pollServerUploadProgress(emitter, data);
                            }, 2000);
                        }
                    });

                    emitter.$on(fileman.UPLOAD_EVENTS.waiting, function (event, data) {
                        data.emitter = emitter;
                        scope.uploads[data.progress.id] = data;
                        data.progress.title = 'Waiting';
                    });
                }

                scope.$on(fileman.UPLOAD_EVENTS.start, function (event, emitter) {
                    scope.refreshingFolder = true;
                    scope.refreshingProgress = true;
                    uploadProgressListener(emitter);
                });

                scope.cancelUpload = function (id, progress) {
                    var data = scope.uploads[progress.id];
                    http.abortUploadFiles(id, progress);
                    $http.get('storage/upload/abort?formId=' + progress.formId);
                    clearProgress(progress.id, progress.path);
                    data.emitter.$emit(fileman.UPLOAD_EVENTS.complete, data);
                };
            }
        };
    }]);
}(window.JP.getModule('Storage'), window.angular));
