'use strict';

(function (app) {

    app.factory('fileman', [
        'Account',
        'serverTab',
        function (Account, serverTab) {
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
                    window.open('storage/show?path=' + window.btoa(unescape(encodeURIComponent(path))), '_blank');
                } else {
                    window.location.href = 'storage/download?path=' + window.btoa(unescape(encodeURIComponent('~~/' + path)));
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

            fileman.saveFilemanConfig = function (path) {
                var filemanConfig = Account.getUserConfig().$child('fileman');
                filemanConfig['path'] = path;
                filemanConfig.dirty(true);
                filemanConfig.$save();
            };

            return fileman;
        }
    ]);

})(window.JP.getModule('Storage'));
