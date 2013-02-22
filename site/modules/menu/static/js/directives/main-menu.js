'use strict';

(function(ng, app){
  app.directive('mainMenu', function($timeout, Menu){    
    return {
      link: function(scope, element, attrs) {
        scope.mainMenu = Menu.getMenu();
      },

      controller: function($scope, requestContext) {
          $scope.$on( 'requestContextChanged', function() {
              $scope.mainMenu.forEach(function(item){
                 item.active = requestContext.startsWith(item.link);
              });
          })
      },

      template:'<div class="navbar-inner"><div class="brand"><img src="/static/vendor/bootstrap/img/joyentcloud.png" alt="JoyentCloud"></div><ul class="nav">' +
        '<li data-ng-repeat="item in mainMenu" class="menuitem" ng-class="{active: item.active}">' +
          '<a href="#!/{{item.link}}">{{item.name}}</a>' +
        '</li>' +
      '</ul></div>'

    };
  });
})(angular, JoyentPortal);