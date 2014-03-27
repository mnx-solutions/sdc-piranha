(function (app) {
    "use strict";

    app.factory('fileman', [
        'serverTab',
        function (serverTab) {
            var $scope;
            var username;
            var fileman = {};

            fileman.setScope = function (scope) {
                $scope = scope;
                username = $scope.mantaUser;
            };

            function createMethod(name) {
                return function (path, data, callback) {
                    if (typeof (data) === 'function') {
                        callback = data;
                        data = {};
                    }
                    data.path = '/' + username + '/' + path;
                    data.originPath = path;

                    serverTab.call({
                        name: name,
                        data: data,
                        done: callback
                    });
                };
            }

            fileman.getUser = function (callback) {
                serverTab.call({name: 'FileManGetUser', data: {}, done: callback});
            };

            fileman.ls = createMethod('FileManList');

            fileman.get = function (path) {
                location.href = 'fileman/download?path=' + '/' + username + '/' + path;
            };

            fileman.rmr = createMethod('FileManDeleteTree');

            fileman.unlink = createMethod('FileManDeleteFile');

            fileman.info = createMethod('FileManInfo');

            fileman.put = createMethod('FileManPut');

            fileman.mkdir = createMethod('FileManCreateFolder');

            fileman.storageReport = createMethod('FileManStorageReport');

            return fileman;
        }
    ]);

})(window.JP.getModule('fileman'));