'use strict';

(function (app) {
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
                        $('.footer').addClass('leftpanel-small');
                    }else{
                        $('.footer').removeClass('leftpanel-small');
                    }
                }
            },

            link: function (scope, element, attr) {
//                console.warn(element.html());
            }
        };
    }]);

}(window.JP.getModule('Left')));