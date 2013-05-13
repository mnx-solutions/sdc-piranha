'use strict';

(function (app) {
    app.factory('CMSService', [
        '$http',
        '$q',
        function ($http, $q) {
            var data = null;
            function findFromData(id) {
                if(!id) {
                    return data;
                }
                var res = null;
                data.forEach(function (el) {
                    if(el.id === id) {
                        res = el;
                    }
                });
                return res;
            }
            return {
                getData: function (id) {
                    var ret = $q.defer();
                    if(!data) {
                        $http.get('cms').success(function (d) {
                            data = d;
                            ret.resolve(findFromData(id));
                        });
                    } else {
                        ret.resolve(findFromData(id));
                    }
                    return ret.promise;
                },
                setData: function (id, data, callback) {
                    $http.post('cms/' + id, data).success(function () {
                        var el = findFromData(id);
                        el.data = data;
                        callback();
                    }).error(function () {
                        callback(true);
                    });
                }
            };
        }
    ]);
}(window.JP.getModule('CMS')));