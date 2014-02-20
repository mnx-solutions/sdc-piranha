//noinspection JSLint
(function (app, ng) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        'localization',
        'requestContext',
        'fileman',
        '$timeout',
        function ($scope, localization, requestContext, fileman, $timeout) {
            //TODO: Move fileman to storage module
            localization.bind('fileman', $scope);
            requestContext.setUpRenderContext('fileman.index', $scope);
            fileman.setScope($scope);

            $scope.loadingFileman = false;
            $scope.loading = true;
            $scope.filesTree = {};
            $scope.getColumnClass = function (index) {
                return index === 0 ? 'general-column' : 'finder-column';
            };
            $scope.setCurrentPath = function setCurrentPath(path, force) {
                var fullPath = path === '/' ? path : ('/' + path.parent.split('/').slice(2).join('/') + '/' + path.path);
                if ($scope.loadingFileman) {
                    return;
                }
                if (path && path.type && path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + path.name);
                    return;
                }

                $scope.loadingFileman = true;
                if (!force) {
                    fullPath = (path && (path.full || path.name)) || fullPath || $scope.currentPath || '/';
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

                fileman.ls($scope.currentPath, function (error, result) {
                    $scope.files = result.__read();
                    if ($scope.filesTree[$scope.currentPath] !== $scope.files) {
                        $scope.filesTree[$scope.currentPath] = $scope.files;
                    }
                    $scope.loadingFileman = false;
                    $scope.loading = false;
                    var scrollContent = ng.element('.folder-container-sub');
                    var fileBoxWidth = ng.element('.finder-column .files-box').width()+1;
                    $timeout(function () {
                        scrollContent.scrollLeft(scrollContent.scrollLeft()+fileBoxWidth);
                    })

                });
            };

            $scope.addFile = function () {
                //TODO: Check if implementation needed
                return false;
            };

            if (!$scope.currentPath) {
                return $scope.setCurrentPath('/');
            }

        }
    ]);
})(window.JP.getModule('fileman'), angular);