'use strict';

(function (ng, app, $) {
    app.controller(
        'CMSAdmin.EditController',
        [
            '$scope',
            'requestContext',
            'CMSService',
            '$q',
            function ($scope, requestContext, CMSService, $q) {
                requestContext.setUpRenderContext('cms-admin.edit', $scope);
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
                    var data = null;
                    try {
                        if($scope.el.type === 'json'){
                            data = JSON.parse($scope.data);
                        } else {
                            data = {
                                data: $('#editor').html()
                            };
                            $scope.data = data.data;
                        }
                        CMSService.setData(id, data, function (err) {
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
                        $scope.message = 'INVALID JSON';
                        return;
                    }
                };
            }

        ]);
}(window.angular, window.JP.getModule('CMS'), window.jQuery));
