'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');
    var utils = scope.get('utils');

    setImmediate(callback);
}