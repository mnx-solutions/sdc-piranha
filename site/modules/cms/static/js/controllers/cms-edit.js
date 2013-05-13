'use strict';

(function (ng, app, $) {
    app.controller(
        'CMSEditController',
        [
            '$scope',
            'requestContext',
            'CMSService',
            '$q',
            function ($scope, requestContext, CMSService, $q) {
                requestContext.setUpRenderContext('cms.edit', $scope);
                var id = requestContext.getParam('id');
                $scope.el = CMSService.getData(id);
                $q.when($scope.el, function (el){
                    if(el.type === 'json') {
                        $scope.data = JSON.stringify(el.data, null, 2);
                    } else {
                        $scope.data = el.data;
                    }
                });
                $scope.error = null;

                $scope.saveData = function() {
                    $scope.error = null;
                    var d = null;
                    try {
                        if($scope.el.type === 'json'){
                            d = JSON.parse($scope.data);
                        } else {
                            d = {
                                data: $('#editor').html()
                            };
                            $scope.data = d.data;
                        }
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
}(window.angular, window.JP.getModule('CMS'), window.jQuery));
