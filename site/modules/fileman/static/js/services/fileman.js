(function(app) {
    "use strict";
    var username = 'dbqp';
    
    app.factory('fileman', [
        'serverTab',
        function(serverTab) {
            var fileman = {};
            function createMethod(name) {
                return function(path, data, callback) {
                    if (typeof data === 'function') {
                        callback = data;
                        data = {};
                    }
                    data.path = '/' + username + '/' + path;

                    serverTab.call({
                        name: name,
                        data: data,
                        done: callback
                    });
                };
            }
            fileman.ls = createMethod('ls');
            
            fileman.get = function(path) {
                location.href='fileman/download?path=' + '/' + username + '/' + path;
            };

            fileman.rm = createMethod('rm');
            
            fileman.info = createMethod('info');
            
            fileman.put = createMethod('put');
            return fileman;
        }
    ]);
    
})(window.JP.getModule('fileman'));