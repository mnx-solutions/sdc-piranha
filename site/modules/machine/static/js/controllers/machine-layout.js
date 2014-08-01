'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'Image', 'requestContext', 'localization', 'PopupDialog',
                function ($scope, Image, requestContext, localization, PopupDialog) {
                    requestContext.setUpRenderContext('machine', $scope,
                        {
                            title: localization.translate(null, 'machine', 'Instances')
                        }
                    );
                    Image.image().then(function (data) {
                        $scope.images = data;
                        $scope.loading = false;
                    }, function (err) {
                        PopupDialog.errorObj(err);
                        $scope.images = [];
                        $scope.loading = false;
                    });

                }
            ]);
}(window.JP.getModule('Machine')));