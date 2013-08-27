'use strict';

window.JP.main.filter('date', function () {
    return function (dateString) {
        return window.moment(new Date(dateString)).format('MMM Do');
    };
});