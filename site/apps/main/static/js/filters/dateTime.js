'use strict';

window.JP.main.filter('dateTime', function () {
    return function (dateString, expression) {
        return window.moment(new Date(dateString)).format(expression || 'YYYY-MM-DD HH:mm:ss');
    };
});