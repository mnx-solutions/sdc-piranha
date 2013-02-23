'use strict';

(function( ng, app ){
  app.controller(
    'WideController',
    function($scope, requestContext) {
      var renderContext = requestContext.setUpRenderContext('wide', $scope);

    }
  );

})(window.angular, window.JoyentPortal);