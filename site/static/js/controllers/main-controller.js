'use strict';

(function(ng, app){
  app.controller(
    'MainController',
    function($scope, $rootScope, $route, $routeParams, requestContext){
      $scope.pageTitle = 'Joyent Portal';

      $scope.setWindowTitle = function(title){
        $scope.windowTitle = title;
      };

      // Get the render context local to this controller (and relevant params).
      var renderContext = requestContext.getRenderContext();

      // The subview indicates which view is going to be rendered on the page.
      $scope.subview = renderContext.getNextSection();

      // I handle changes to the request context.
      $scope.$on(
        'requestContextChanged',
        function() {
          // Make sure this change is relevant to this controller.
          if(!renderContext.isChangeRelevant()) {
            return;
          }

          // Update the view that is being rendered.
          $scope.subview = renderContext.getNextSection();
        }
      );


      // Listen for route changes so that we can trigger request-context change events.
      $scope.$on(
        '$routeChangeSuccess',
        function(event) {
          // If this is a redirect directive, then there's no action to be taken.
          if(!$route.current.action) {
            return;
          }

          // Update the current request action change.
          requestContext.setContext($route.current.action, $routeParams);

          // Announce the change in render conditions.
          $scope.$broadcast('requestContextChanged', requestContext);
        }
      );

      $scope.requireLogin = function() {
        $rootScope.$broadcast('event:auth-loginRequired');
      };
      
      $scope.cancelLogin = function(){
        $scope.subview = oldSubview;
      };
      
      var oldSubview;
      $scope.$on('event:auth-loginRequired', function() {
        oldSubview = $scope.subview;
        $scope.subview = 'login';
      });

      $scope.$on('event:auth-loginConfirmed', function() {
        $scope.subview = oldSubview;
      });
    }
  );
})(window.angular, window.JoyentPortal);
