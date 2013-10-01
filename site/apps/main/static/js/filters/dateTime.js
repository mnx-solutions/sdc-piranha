'use strict';

window.JP.main.filter('dateTime', function () {
    return function (dateString) {
        return window.moment(new Date(dateString)).format('YYYY-MM-DD HH:mm:ss');
    };
});