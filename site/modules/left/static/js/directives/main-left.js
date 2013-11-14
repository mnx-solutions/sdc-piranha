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
                $scope.openMenu = false;
                $scope.toggleSideBar = function () {
                    $scope.sideBarMin = ($scope.sideBarMin == false) ? true : false;
                    if($scope.sideBarMin){
                        $('.footer').addClass('leftpanel-small');
                        $scope.openMenu = false;
                    }else{
                        $('.footer').removeClass('leftpanel-small');
                    }
                };
                $scope.openSubMenu = function(){
                    $scope.openMenu = ($scope.openMenu) ? false : true;
                }
            },

            link: function (scope, element, attr) {
//                console.warn(element.html());
            }
        };
    }]);

}(window.JP.getModule('Left')));