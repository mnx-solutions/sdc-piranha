'use strict';

(function (app) {
    app.filter('humanDate', function () {
        return function (time) {

             var diff = Math.abs(Math.ceil(new Date().getTime() / 1000) - time),
                day_diff = Math.floor(diff / 86400),
                month_diff = Math.floor(day_diff / 30),
                year_diff = Math.floor(day_diff / 365);

            if (isNaN(day_diff) || day_diff < 0) {
                return;
            }

            return day_diff == 0 && (
                diff < 60 && "moments ago" ||
                diff < 120 && "1 minute ago" ||
                diff < 3600 && Math.floor(diff / 60) + " minutes ago" ||
                diff < 7200 && "1 hour ago" ||
                diff < 86400 && Math.floor(diff / 3600) + " hours ago") ||
                day_diff == 1 && "yesterday" ||
                day_diff < 7 && day_diff + " days ago" ||
                day_diff < 31 && Math.ceil(day_diff / 7) + " weeks ago" ||
                month_diff == 1 && "month ago" ||
                day_diff < 365 && Math.floor(day_diff / 30) + " months ago" ||
                year_diff == 1 && "month ago" ||
                Math.floor(day_diff / 365) + "years ago";
        };
    });

}(window.JP.getModule('docker')));
