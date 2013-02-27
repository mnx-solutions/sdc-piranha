'use strict';

window.JP.main.filter('fromNow', function () {
	return function (dateString) {
		return window.moment(new Date(dateString)).fromNow();
	};
});