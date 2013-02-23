(function(ng, app){
  app.config(function($routeProvider) {
    $routeProvider
      .when('/',{
        action:'landing.home'
      })
      .otherwise({redirectTo: '/'});
  });
})(window.angular, window.JoyentPortal);