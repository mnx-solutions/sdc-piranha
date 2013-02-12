'use strict';

(function( ng, app ){
  app.controller(
    'WideController',
    function($scope, requestContext) {
      var renderContext = requestContext.setUpRenderContext('wide', $scope);

    }
  );

})(angular, JoyentPortal);