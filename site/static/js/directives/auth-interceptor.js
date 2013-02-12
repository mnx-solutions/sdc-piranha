(function(ng, app) {
  'use strict';

  app.directive('authInterceptor', function() {
    return {
      restrict: 'C',
      link: function(scope, elem, attrs) {
        var container = $('#login-container');
        container.hide();

        scope.$on('event:auth-loginRequired', function() {
          container.show();
        });

        scope.$on('event:auth-loginConfirmed', function() {
          container.hide();
        });
      }
    };
  });
})(angular, JoyentPortal);