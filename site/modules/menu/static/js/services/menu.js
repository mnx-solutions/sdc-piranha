'use strict';

(function(ng, app) {
  // I provide information about the current route request.
  app.factory('Menu', ['$resource', function ($resource, requestContext) {
    var Menu = $resource('/menu', {}, {});
    var mainMenu = [];
    Menu.getMenu = function(){
      return mainMenu;
    };

    Menu.register = function(item){
      mainMenu.push(item);
    };

    return Menu;
  }]);
})(angular, JoyentPortal);