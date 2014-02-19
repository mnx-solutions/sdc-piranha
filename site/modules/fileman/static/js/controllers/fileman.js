//noinspection JSLint
(function (app) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        'localization',
        'requestContext',
        'fileman',
        function ($scope, localization, requestContext, fileman) {
            //TODO: Move fileman to storage module
            localization.bind('fileman', $scope);
            requestContext.setUpRenderContext('fileman.index', $scope);
            fileman.setScope($scope);

            $scope.loadingFileman = false;
            $scope.loading = true;
            $scope.filesTree = {};
            $scope.getColumnClass = function (index) {
                if (index === 0) {
                    return 'general-column';
                } else {
                    return 'finder-column';
                }
            };
            $scope.setCurrentPath = function setCurrentPath(path, force) {
                if ($scope.loadingFileman) {
                    return;
                }
                if (this.path && this.path.type && this.path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + this.path.name);
                    return;
                }

                $scope.loadingFileman = true;
                if (!force) {
                    path = (this.path && (this.path.full || this.path.name)) || path || $scope.currentPath || '/';
                    $scope.currentPath = $scope.currentPath || path;
                } else {
                    $scope.currentPath = path;
                }
                if (path[0] === '/') {
                    $scope.currentPath = path;
                } else {
                    $scope.currentPath += $scope.currentPath.substr(-1) !== '/' ? '/' + path : path;
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
                                if (el.name === $scope.splittedCurrentPath[i].name && (index + '/' + el.name).replace(/\/+/, '/') === $scope.splittedCurrentPath[i].full.replace(/\/+/, '/')) {
                                    el.active = true;
                                }
                            }
                        });
                    }
                    for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                        var fullPath = $scope.splittedCurrentPath[i].full;
                        if (index === '/' + fullPath || index === fullPath) {
                            tmpFilesTree[fullPath] = $scope.filesTree[index];
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
})(window.JP.getModule('fileman'));