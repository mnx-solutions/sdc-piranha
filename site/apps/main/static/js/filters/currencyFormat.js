'use strict';

window.JP.main.filter('currencyFormat', function () {
    return function (amount, showCents) {
        var output;
        amount = parseFloat(amount, 10);
        if (!amount || isNaN(amount)) {
            output = '$0.00';
        } else if (amount < 1 && showCents) {
            output = (amount * 100).toFixed(2) + 'c';
        } else if (amount < 100) {
            output = '$' + amount.toFixed(2);
        } else {
            output = '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        return output;
    };
});
