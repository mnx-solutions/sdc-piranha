'use strict';

window.JP.main.filter('dateTime', function () {
    return function (dateString, format) {
        return window.moment(new Date(dateString)).format(format || 'MMM Do');
    };
});