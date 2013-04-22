'use strict';

(function (app) {
    app.factory('CMSService', [
        '$http',
        '$q',
        function ($http, $q) {
            var data = null;
            return {
                getData: function (id) {
                    var ret = $q.defer();
                    if(!data) {
                        $http.get('cms').success(function (d) {
                            ret.resolve(id ? JSON.stringify(d[id], null, '  ') : d);
                        });
                    } else {
                        ret.resolve(id ? JSON.stringify(data[id], null, '  ') : data);
                    }
                    return ret.promise;
                },
                setData: function (id, data, callback) {
                    $http.post('cms/' + id, data).success(function () {
                        data[id] = data;
                        callback();
                    }).error(function () {
                        callback(true);
                    });
                }
            };
        }
    ]);
}(window.JP.getModule('CMS')));