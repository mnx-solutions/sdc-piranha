'use strict';

(function (ng, app) {
    app.controller(
        'CMSEditController',
        [
            '$scope',
            'requestContext',
            'CMSService',

            function ($scope, requestContext, CMSService) {
                requestContext.setUpRenderContext('cms.edit', $scope);
                var id = requestContext.getParam('id');
                $scope.data = CMSService.getData(id);
                $scope.error = null;

                $scope.saveData = function() {
                    $scope.error = null;
                    var d = null;
                    try {
                        d = JSON.parse($scope.data);
                        CMSService.setData(id, d, function (err) {
                            if(err) {
                                $scope.message = 'FAILED TO SAVE';
                            } else {
                                $scope.message = 'SAVED';
                                setTimeout(function () {
                                    $scope.message = null;
                                }, 8000);
                            }
                        });
                    } catch(e) {
                        console.log($scope.data);
                        console.log(e);
                        $scope.message = 'INVALID JSON';
                        return;
                    }
                };
            }

        ]);
}(window.angular, window.JP.getModule('CMS')));
