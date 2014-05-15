(function (app) {
    "use strict";

    app.factory('fileman', [
        'serverTab', 'Account',
        function (serverTab, Account) {
            var fileman = {};

            function createMethod(name) {
                return function (path, data, callback) {
                    if (typeof (data) === 'function') {
                        callback = data;
                        data = {};
                    }
                    Account.getAccount().then(function (account) {
                        data.path = '/' + account.login + '/' + path;
                        data.originPath = path;
                        serverTab.call({
                            name: name,
                            data: data,
                            done: callback
                        });
                    });
                };
            }

            fileman.getUser = function (callback) {
                serverTab.call({name: 'FileManGetUser', data: {}, done: callback});
            };

            fileman.ls = createMethod('FileManList');

            fileman.get = function (path) {
                Account.getAccount().then(function (account) {
                    location.href = 'storage/download?path=' + '/' + account.login + '/' + path;
                });
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

})(window.JP.getModule('Storage'));