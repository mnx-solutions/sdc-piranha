"use strict";

(function (app) {

    app.factory('fileman', [
        'serverTab',
        function (serverTab) {
            var fileman = {};

            function createMethod(name, isAbsolutePath) {
                return function (path, data, callback) {
                    if (typeof (data) === 'function') {
                        callback = data;
                        data = {};
                    }

                    data.originPath = path;
                    if (isAbsolutePath) {
                        data.path = path;
                        return serverTab.call({
                            name: name,
                            data: data,
                            done: callback
                        });
                    } else {
                        data.path = '~~' + path;
                        return serverTab.call({
                            name: name,
                            data: data,
                            done: callback
                        });
                    }
                };
            }

            fileman.getUser = function (callback) {
                serverTab.call({name: 'FileManGetUser', data: {}, done: callback});
            };

            fileman.ls = createMethod('FileManList');

            fileman.lsAbsolute = createMethod('FileManList', true);

            fileman.get = function (path, show) {
                    if (show) {
                        window.open('storage/show?path=' + path, '_blank');
                    } else {
                        window.location.href = 'storage/download?path=' + '~~/' + path;
                    }
            };

            fileman.rmr = createMethod('FileManDeleteTree');

            fileman.unlink = createMethod('FileManDeleteFile');

            fileman.info = createMethod('FileManInfo');

            fileman.getRoles = createMethod('FileManGetRoles');

            fileman.setRoles = createMethod('FileManSetRoles');

            fileman.getFile = createMethod('FileManGet');

            fileman.infoAbsolute = createMethod('FileManInfo', true);

            fileman.put = createMethod('FileManPut');

            fileman.mkdir = createMethod('FileManCreateFolder');

            fileman.storageReport = createMethod('FileManStorageReport');

            fileman.mfind = createMethod('FileManMfind', true);

            return fileman;
        }
    ]);

})(window.JP.getModule('Storage'));