(function(app) {
    "use strict";
    app.controller('Fileman.IndexController', [
        '$scope',
        'localization',
        'requestContext',
        'fileman',
        function($scope, localization, requestContext, fileman) {
            localization.bind('dashboard-admin', $scope);
            requestContext.setUpRenderContext('dashboard-admin.index', $scope);
            var inProgress = false;
            $scope.setCurrentPath = function setCurrentPath(path) {
                if (inProgress) return;
                if (this.path && this.path.type && this.path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + this.path.name);
                    return;
                }

                inProgress = true;
                path = this.path && (this.path.full || this.path.name) || path || $scope.currentPath || '/';

                $scope.currentPath = $scope.currentPath || path;
                if (path[0] === '/') {
                    $scope.currentPath = path;
                } else {
                    $scope.currentPath += $scope.currentPath.substr(-1) !== '/' ? '/' + path : path;
                }
                console.warn('Path: ', path, $scope.currentPath);

                $scope.splittedCurrentPath = $scope.currentPath.split(/\/([^/]+)/)
                    .filter(function(e) {
                        return !!e;
                    });

                if ($scope.splittedCurrentPath[0] !== '/') {
                    $scope.splittedCurrentPath.unshift('/');
                }

                $scope.splittedCurrentPath = $scope.splittedCurrentPath.map(function(e, index, array) {
                    return {
                        name: e,
                        full: array.slice(0, index+1).join('/').substr(1)
                    };
                });

                fileman.ls($scope.currentPath, function(error, result) {
                    $scope.files = result.__read();
                    inProgress = false;
                });
            };

            $scope.addFile = function() {
                console.warn(arguments);
                return false;
            };
            
            if(!$scope.currentPath) {
                return $scope.setCurrentPath('/');
            }

        }
    ]);
})(window.JP.getModule('fileman'));