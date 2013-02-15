'use strict';

(function(ng, app){
  app.directive('machineList', function($timeout, Machine){
    return {
      link: function(scope, element, attrs) {
        var timeoutId;

        scope.machines = [];

        // used to update the UI
        function updateTime() {
          scope.machines = Machine.query();
        }

        // schedule update in one second
        function updateLater() {
          // save the timeoutId for canceling
          timeoutId = $timeout(function() {
            updateTime(); // update DOM
            updateLater(); // schedule another update
          }, 10000);
        }

        // listen on DOM destroy (removal) event, and cancel the next UI update
        // to prevent updating time ofter the DOM element was removed.
        element.bind('$destroy', function() {
          $timeout.cancel(timeoutId);
        });

        updateTime();
        updateLater(); // kick off the UI update process.
      },
      template:'<ul>' +
        '<li data-ng-repeat="machine in machines">' +
          '{{machine.id}}: {{machine.created}}' +
        '</li>' +
      '</ul>'
    };
  });
})(angular, JoyentPortal);