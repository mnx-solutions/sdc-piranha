'use strict';

(function(ng, app) {
	app.filter('fromNow', function() {
    	return function(dateString) {
      		return moment(new Date(dateString)).fromNow();
    	};
	});
})(angular, JoyentPortal);