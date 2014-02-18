'use strict';

(function (app, ng) {
    app.directive('mainLeft', ['localization', function (localization) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            controller: function ($scope, $location){
                $scope.location = $location;
                $scope.sideBarMin = false;
                $scope.t_start = false;
                $scope.t_second = false;
                $scope.t_three = false;
                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = ($scope.sideBarMin == false) ? true : false;
                    if($scope.sideBarMin){
                        ng.element('.footer').addClass('leftpanel-small');
                    }else{
                        ng.element('.footer').removeClass('leftpanel-small');
                    }
                };
            }
        };
    }]);

}(window.JP.getModule('Left'), angular));