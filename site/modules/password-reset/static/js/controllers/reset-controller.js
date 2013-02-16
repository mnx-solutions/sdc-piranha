'use strict';

(function( ng, app ){
  app.controller(
    'ResetPassword',
    function($scope, requestContext) {
        $scope.resetPwd = function ()
        {
            console.log("Reset"+ $scope.credential)
        }
    }
  );

})(angular, JoyentPortal);