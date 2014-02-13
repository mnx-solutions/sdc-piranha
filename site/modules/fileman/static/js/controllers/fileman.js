//noinspection JSLint
(function (app) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        'localization',
        'requestContext',
        'fileman',
        function ($scope, localization, requestContext, fileman) {
            localization.bind('dashboard-admin', $scope);
            requestContext.setUpRenderContext('dashboard-admin.index', $scope);
            fileman.setScope($scope);

            var inProgress = false;
            $scope.filesTree = {};
            $scope.setCurrentPath = function setCurrentPath(path, force) {
                if (inProgress) {
                    return;
                }
                if ($scope.path && $scope.path.type && $scope.path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + $scope.path.name);
                    return;
                }

                inProgress = true;
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

                        if ($scope.filesTree.hasOwnProperty(index)) {
                            for (i = 0; i < $scope.splittedCurrentPath.length; i += 1) {
                                if (index === '/' + $scope.splittedCurrentPath[i].full || index === $scope.splittedCurrentPath[i].full) {
                                    tmpFilesTree[$scope.splittedCurrentPath[i].full] = $scope.filesTree[index];
                                }
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
                    inProgress = false;
                });
            };

            $scope.addFile = function () {
                return false;
            };

            if (!$scope.currentPath) {
                return $scope.setCurrentPath('/');
            }

        }
    ]);
})(window.JP.getModule('fileman'));