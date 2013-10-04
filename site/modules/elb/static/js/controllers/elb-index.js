'use strict';

(function (app) {
    app.controller(
        'elb.IndexController',
        ['$scope', 'requestContext', 'localization', '$location', 'util',  function ($scope, requestContext, localization, $location, util) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.index', $scope, {
                title: localization.translate(null, 'elb', 'Enable Load Balancing')
            });

            $scope.enableElb = function () {
                $location.path('/elb/list');
            };

            $scope.license = function() {
                console.log('modal');
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Enable Load Balacer'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'license text...'
                    ), function () {
                        $scope.changeLocation('/elb/list/');
                    });
            };

        }]);
}(window.JP.getModule('elb')));
