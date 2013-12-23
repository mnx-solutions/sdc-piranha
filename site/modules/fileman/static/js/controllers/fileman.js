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
            $scope.filesTree = {};
            $scope.setCurrentPath = function setCurrentPath(path, force) {
                if (inProgress) return;
                if (this.path && this.path.type && this.path.type !== 'directory') {
                    fileman.get($scope.currentPath + '/' + this.path.name);
                    return;
                }

                inProgress = true;
                if (!force) {
                    path = this.path && (this.path.full || this.path.name) || path || $scope.currentPath || '/';
                    $scope.currentPath = $scope.currentPath || path;
                } else {
                    $scope.currentPath = path;
                }
                if (path[0] === '/') {
                    $scope.currentPath = path;
                } else {
                    $scope.currentPath += $scope.currentPath.substr(-1) !== '/' ? '/' + path : path;
                }
//                console.warn('Path: ', path, $scope.currentPath);



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

                if(this.path) this.path.active = true;
                var tmpFilesTree = {};
                for(var index in $scope.filesTree) {
                    if ($scope.filesTree.hasOwnProperty(index)) {
                        $scope.filesTree[index].forEach(function(el){
                            if(el.active){
                                el.active = false;
                                for(var i=0;i<$scope.splittedCurrentPath.length;i++){
                                    if(el.name == $scope.splittedCurrentPath[i].name){
                                        el.active = true;
                                    }
                                }
                            }
                        });
                        if ($scope.filesTree.hasOwnProperty(index)) {
                            for(var i=0;i<$scope.splittedCurrentPath.length;i++){
                                if(index == '/'+$scope.splittedCurrentPath[i].full || index == $scope.splittedCurrentPath[i].full){
                                    tmpFilesTree[$scope.splittedCurrentPath[i].full] = $scope.filesTree[index];
                                }
                            }
                        }
                    }
                }
                $scope.filesTree = tmpFilesTree;

                fileman.ls($scope.currentPath, function(error, result) {
                    $scope.files = result.__read();
                    if($scope.filesTree[$scope.currentPath] != $scope.files){
                        $scope.filesTree[$scope.currentPath] = $scope.files;
                    }
                    inProgress = false;
                });
            };

            $scope.addFile = function() {
//                console.warn(arguments);
                return false;
            };
            
            if(!$scope.currentPath) {
                return $scope.setCurrentPath('/');
            }

        }
    ]);
})(window.JP.getModule('fileman'));