(function(ng, app) {
  'use strict';

    app.directive('resetWindow', function() {
    return {
     restrict: 'E',
     scope: {linkname: "@linkName"},
     controller: function($scope){
          $scope.open = function () {
              $scope.shouldBeOpen = true;
          };
          $scope.close = function () {
              $scope.shouldBeOpen = false;
          };
      },
      templateUrl: "password-reset/static/js/directives/template.html"
    };
  });
})(angular, JoyentPortal);