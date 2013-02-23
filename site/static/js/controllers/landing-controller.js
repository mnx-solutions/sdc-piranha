'use strict';

(function( ng, app ){
  app.controller(
    'LandingController',
    function($scope, requestContext) {
      var renderContext = requestContext.setUpRenderContext('landing', $scope);
    }
  );

})(window.angular, window.JoyentPortal);