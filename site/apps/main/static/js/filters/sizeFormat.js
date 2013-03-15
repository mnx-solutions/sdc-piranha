'use strict';

window.JP.main.filter('sizeFormat', function () {
    return function (size) {
        if (size >= 1024) {
            size = (size/1024) + ' GB';
        } else {
            size = size + ' MB';
        }
        return size;
    };
});