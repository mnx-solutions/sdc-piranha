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
                $scope.openMenu = [false,false,false];
                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = ($scope.sideBarMin == false) ? true : false;
                    if($scope.sideBarMin){
                        ng.element('.footer').addClass('leftpanel-small');
                        $scope.openMenu = false;
                    }else{
                        ng.element('.footer').removeClass('leftpanel-small');
                    }
                };
                $scope.openSubMenu = function(n){
                    if(n != 0){
                        $scope.openMenu[n] = ($scope.openMenu[n]) ? false : true;
                    } $scope.openMenu = [false,false,false];
                }
            },

            link: function (scope, element, attr) {
//                console.warn(element.html());
            }
        };
    }]);

}(window.JP.getModule('Left'), angular));