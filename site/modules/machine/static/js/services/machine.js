'use strict';


(function (app) {
    app.factory('Machines', ['$resource', '$q', function ($resource, $q) {
            var service = {};

            var machines = [];
	          var loaded = false;
	          var onLoad = [];

	          function execOnload(){
		          onLoad.forEach(function(el){
			          el();
		          });
	          }

            // load machines
            machines = $resource('/machine', {}, {}).query(function() {
	            loaded = true;
	            execOnload();
            });

            /* get reference to the machines list */
            service.getMachines = function () {
                return machines;
            };

            /* find machine by uuid */
            service.getMachine = function (uuid) {
	            if (loaded) {
		            var tmp = machines.filter(function (machine) {
			            return machine.id === uuid;
		            });
		            return tmp[0];
	            } else {
		            var deferred = $q.defer();
		            onLoad.push(function() {
			            var tmp = machines.filter(function (machine) {
				            return machine.id === uuid;
			            });
			            deferred.resolve(tmp[0]);
		            });

		            return deferred.promise;
	            }
            };

            return service;
        }]);
}(window.JP.getModule('Machine')));
