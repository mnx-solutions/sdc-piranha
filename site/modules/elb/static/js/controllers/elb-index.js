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
                $scope.changeLocation('/elb/list/');
            };

            $scope.licenseAcceptCheck = false;
            $scope.licenseAccept = function(){
                $scope.licenseAcceptCheck = ($scope.licenseAcceptCheck) ? false : true;
            }

        }]);
}(window.JP.getModule('elb')));
