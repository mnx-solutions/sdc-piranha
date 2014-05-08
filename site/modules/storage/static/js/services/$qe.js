(function (app) {
    "use strict";

    app.factory('$qe', [
        '$q',
        function ($q) {

            /**
             * Creates a promise-returning function from a Node.js-style function
             *
             * var readFile = $qe.denodeify(FS.readFile);
             * readFile("foo.txt", "utf-8").done(function (text) {});
             *
             * Should be the same as kriskowal's one here: https://github.com/kriskowal/q/wiki/API-Reference
             *
             * @param func Node-style function
             * @returns {Function}
             */
            $q.denodeify = function (func) {
                return function () {
                    var d = $q.defer();
                    [].push.call(arguments, function (err) {
                        if (err) {
                            d.reject(err);
                            return;
                        }
                        d.resolve([].slice.call(arguments, 1));
                    });
                    func.apply(this, arguments);
                    return d.promise;
                };
            };

            /**
             * Transforms array of promises into one chained promise
             *
             * @param arr Array of promises
             * @param initial Initial promise
             * @returns {Promise}
             */
            $q.series = function (arr, initial) {
                return arr.reduce(function (soFar, newPromise) {
                    return soFar.then(newPromise);
                }, $q.when(initial));
            };

            return $q;
        }
    ]);

})(window.JP.getModule('Storage'));