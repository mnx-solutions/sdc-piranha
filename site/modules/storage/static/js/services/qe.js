"use strict";
(function (app) {

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

            /**
             * @ngdoc method
             * @name $qe#every
             * @function
             *
             * @description
             * Combines multiple promises into a single promise that is resolved when all of the input
             * promises are resolved or rejected.
             *
             * @param {Array.<Promise>|Object.<Promise>} promises An array or hash of promises.
             * @returns {Promise} Returns a single promise that will be resolved with an array/hash of values,
             *   each value corresponding to the promise at the same index/key in the `promises` array/hash.
             *   If any of the promises is resolved with a rejection, this resulting promise collected as resolved
             *   with the {error: rejection} value.
             */
            $q.every = function (promises) {
                var deferred = $q.defer();

                var counter = 0;
                var results = angular.isArray(promises) ? [] : {};

                promises.forEach(function (promise, key) {
                    counter++;
                    ref(promise).then(function (value) {
                        if (results.hasOwnProperty(key)) return;
                        results[key] = value;
                        if (!(--counter)) deferred.resolve(results);
                    }, function (reason) {
                        if (results.hasOwnProperty(key)) return;
                        results[key] = {error: reason};
                        if (!(--counter)) deferred.resolve(results);
                    });
                });

                if (counter === 0) {
                    deferred.resolve(results);
                }
                return deferred.promise;
            };

            var ref = function (value) {
              if (value && angular.isFunction(value.then)) return value;
              return {
                then: function(callback) {
                  var result = $q.defer();
                  nextTick(function() {
                    result.resolve(callback(value));
                  });
                  return result.promise;
                }
              };
            };

            var nextTick = function (callback) {
                $rootScope.$evalAsync(callback);
            };

            var _eachLimit = function (limit) {
                return function (arr, iterator, callback) {
                    callback = callback || function () {};
                    if (!arr.length || limit <= 0) {
                        return callback();
                    }
                    var completed = 0;
                    var started = 0;
                    var running = 0;

                    (function replenish() {
                        if (completed >= arr.length) {
                            return callback();
                        }

                        while (running < limit && started < arr.length) {
                            started += 1;
                            running += 1;
                            iterator(arr[started - 1], function (err) {
                                if (err) {
                                    callback(err);
                                    callback = function () {};
                                } else {
                                    completed += 1;
                                    running -= 1;
                                    if (completed >= arr.length) {
                                        callback();
                                    } else {
                                        replenish();
                                    }
                                }
                            });
                        }
                    }());
                };
            };

            /**
             * No more than limit iterators will be simultaneously running at any time.
             *
             * @param arr - An array to iterate over.
             * @param limit - The maximum number of iterators to run at any time.
             * @param iterator - A function to apply to each item in arr. The iterator is passed a callback(err) which must be called once it has completed. If no error has occured, the callback should be run without arguments or with an explicit null argument.
             * @param callback - A callback which is called when all iterator functions have finished, or an error occurs.
             */
            $q.eachLimit = function (arr, limit, iterator, callback) {
                var fn = _eachLimit(limit);
                fn.apply(null, [arr, iterator, callback]);
            };

            return $q;
        }
    ]);

})(window.JP.getModule('Storage'));