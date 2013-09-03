'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('mainLeft', ['localization', function (localization) {
        return {
            templateUrl: 'left/static/partials/menu.html',
            scope: true,
            link: function (scope, element, attr) {
                scope.sideBarMin = function() {
                    var sidebar = $('.page-sidebar');
                    if(sidebar.hasClass('sidebar-toggler-closed')){
                        sidebar.removeClass('sidebar-toggler-closed');
                        $('.sidebar-toggler').removeClass('sidebar-toggler-back');
                        $('.modulizer-module-left').width(175);
                        $('.modulizer-module-left .page-sidebar').width(175);
                        $('.page-sidebar-menu .title').show();
                        $('.subview').removeClass('leftpanel-small');
                    }else{
                        sidebar.addClass('sidebar-toggler-closed');
                        $('.sidebar-toggler').addClass('sidebar-toggler-back');
                        $('.modulizer-module-left').width(55);
                        $('.modulizer-module-left .page-sidebar').width(55);
                        $('.page-sidebar-menu .title').hide();
                        $('.subview').addClass('leftpanel-small');
                    }
                };
                scope.sideBarMenu = function(){
//                    $('.page-sidebar-menu li').removeClass('active');

                };
//                console.warn(element.html());
            }
        };
    }]);
}(window.JP.getModule('Left')));