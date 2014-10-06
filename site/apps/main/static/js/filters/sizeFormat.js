'use strict';

window.JP.main.filter('sizeFormat', function () {
    return function (size, bytes) {
        size = bytes ? size : size * 1024 * 1024;
        var sizes = [' Bytes', ' KB', ' MB', ' GB', ' TB'];
        var i = parseInt(Math.floor(Math.log(size) / Math.log(1024)), 10);
        return (Math.round(size / Math.pow(1024, i), 2) || 0) + (sizes[i] || sizes[0]);
    };
});