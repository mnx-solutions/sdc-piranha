'use strict';

window.JP.main.filter('sizeFormat', function () {
    return function (size, bytes) {
        size = bytes ? size : size * 1024 * 1024;
        var sizes = [' Bytes', ' KB', ' MB', ' GB', ' TB'];
        var i = parseInt(Math.floor(Math.log(size) / Math.log(1024)), 10);
        var result = size / Math.pow(1024, i);
        var places = result - parseInt(result, 10) ? 1 : 0;
        return result.toFixed(places) + sizes[i];
    };
});