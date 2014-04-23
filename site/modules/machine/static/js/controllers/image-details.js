'use strict';

(function (ng, app) {
    app.controller('Machine.ImageDetailsController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$q',
        'requestContext',
        'Image',
        'localization',
        'PopupDialog',
        '$http',
        '$location',
        'Account',
        '$timeout',

        function ($scope, $cookieStore, $filter, $$track, $q, requestContext, Image, localization, PopupDialog, $http, $location, Account, $timeout) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images-details', $scope, {
                title: localization.translate(null, 'machine', 'Image List')
            });

            var currentImage = requestContext.getParam('currentImage');

            $scope.loading = true;
            $scope.loadingNewName = false;
            $scope.changingName = false;
            $scope.incorrectNameMessage = "can contain only letters, digits and signs like '.' and '-'.";

            $scope.$watch('images.final', function (final) {
                if (final) {
                    $scope.images.forEach(function (image) {
                        if (image.id === currentImage) {
                            $scope.currentImage = image;
                        }
                    });
                    $scope.loading = false;
                    $scope.loadingNewName = false;
                }
            });

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.images = Image.image(true);
                }
            );
        }
    ]);
}(window.angular, window.JP.getModule('Machine')));
