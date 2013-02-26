'use strict';

(function(ng, app) {
  app.controller(
    'MachineController',
    function($scope, requestContext, Machines) {
      var renderContext = requestContext.setUpRenderContext('machine.details', $scope);
      var machineid = requestContext.getParam('machineid');
      $scope.machineid = machineid;
      var selectedmachine = Machines.getMachine(machineid);
      $scope.selectedmachine = selectedmachine[0];
    }
  );
})(angular, JoyentPortal);