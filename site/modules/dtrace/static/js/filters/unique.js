'use strict';

(function (app, ng) {
    app.filter('unique', function () {
        return function (collection, keyname) {
            var output = [];
            var keys = [];

            ng.forEach(collection, function (row) {
                var item = row[keyname];
                if (item === null || item === undefined) {
                    return;
                }
                if (keys.indexOf(item) === -1) {
                    keys.push(item);
                    output.push(row);
                }
            });

            return output;
        };
    });

}(window.JP.getModule('dtrace'), window.angular));
