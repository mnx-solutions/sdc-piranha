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

            var loading = false;
            $scope.filesTree = {};
            $scope.setCurrentPath = function setCurrentPath(path, force) {
                if (loading) {
                    return;
                }
                if ($scope.path && $scope.path.type && $scope.path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + $scope.path.name);
                    return;
                }

                loading = true;
                if (!force) {
                    path = ($scope.path && ($scope.path.full || $scope.path.name)) || path || $scope.currentPath || '/';
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

                if ($scope.path) {
                    $scope.path.active = true;
                }
                var tmpFilesTree = {};
                var i;
                for (var index in $scope.filesTree) {
                    if ($scope.filesTree.hasOwnProperty(index)) {
                        $scope.filesTree[index].forEach(function (el) {
                            if (el.active) {
                                el.active = false;
                                for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                                    if (el.name === $scope.splittedCurrentPath[i].name) {
                                        el.active = true;
                                    }
                                }
                            }
                        });

                        for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                            var fullPath = $scope.splittedCurrentPath[i].full;
                            if (index === '/' + fullPath || index === fullPath) {
                                tmpFilesTree[fullPath] = $scope.filesTree[index];
                            }
                        }
                    }
                }
                $scope.filesTree = tmpFilesTree;

                fileman.ls($scope.currentPath, function (error, result) {
                    $scope.files = result.__read();
                    if ($scope.filesTree[$scope.currentPath] !== $scope.files) {
                        $scope.filesTree[$scope.currentPath] = $scope.files;
                    }
                    loading = false;
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