var config = require('easy-config');
var soap = require('soap');
var path = require('path');

var ZuoraSoapClient = (function () {
    function ZuoraSoapClient() {
        this.client = null;
        this.clientConnectedOn = 0;
        this.clientTimeout = 2 * 60 * 60;
        this.connecting = false;
        this.callbacks = [];
    }
    ZuoraSoapClient.prototype.acquire = function (callback) {
        if (this.client && new Date().getTime() < this.clientConnectedOn + this.clientTimeout) {
            var self = this;
            setImmediate(function () {
                callback(null, self.client);
            });
        } else {
            this.connect(callback);
        }
    };
    ZuoraSoapClient.prototype.fireCallbacks = function (err, result) {
        this.callbacks.forEach(function (finalCallback) {
            finalCallback(err, result);
        });
        this.callbacks = [];
    };
    ZuoraSoapClient.prototype.connect = function (callback) {
        this.callbacks.push(callback);
        if (this.connecting) {
            return;
        }
        this.connecting = true;
        var self = this;
        var wsdl = path.resolve(__dirname, 'config', 'zuora.a.56.0.wsdl');
        soap.createClient(wsdl, {endpoint: config.zuora.soap.endpoint}, function (clientErr, client) {
            if (clientErr) {
                self.fireCallbacks(clientErr);
                return;
            }
            var credentials = {
                username: config.zuora.user,
                password: config.zuora.password
            };
            client.ZuoraService.Soap.login(credentials, function (loginErr, login) {
                if (loginErr) {
                    self.fireCallbacks(loginErr);
                    return;
                }
                client.addSoapHeader({
                    SessionHeader: {
                        session: login.result.Session
                    }
                });
                self.client = client;
                self.connecting = false;
                self.clientConnectedOn = new Date().getTime();
                self.fireCallbacks(null, self.client);
            });
        });
    };
    ZuoraSoapClient.prototype.handleUpdateResponse = function (callback, err, resp) {
        if (err) {
            callback(err);
            return;
        }
        if (!resp.result) {
            callback('No result in Zuora response');
            return;
        }
        var results = resp.result;
        var hasErrors = results.some(function (result) { return !result.Success; });
        if (hasErrors) {
            var accumulatedErrors = results.reduce(function (prev, next) {
                return prev.concat(next.Errors || []);
            }, []);
            callback(accumulatedErrors);
            return;
        }
        callback(null, results);
    };
    ZuoraSoapClient.prototype.handleUpdateRequest = function (zObjects) {
        if (!Array.isArray(zObjects)) {
            zObjects = [zObjects];
        }
        zObjects.forEach(function (zObject) {
            if (zObject.__type) {
                zObject.attributes = zObject.attributes || {};
                zObject.attributes.xsi_type = {
                    type: zObject.__type,
                    xmlns: 'http://object.api.zuora.com/',
                    namespace: 'zo'
                };
                delete zObject.__type;
            }
        });
        return {zObjects: zObjects};
    };
    ZuoraSoapClient.prototype.handleQueryResponse = function (callback, err, resp) {
        if (err) {
            callback(err);
            return;
        }
        var records = resp && resp.result && resp.result.records;
        if (!Array.isArray(records)) {
            callback('No records in response', resp);
            return;
        }
        callback(null, records);
    };

    ZuoraSoapClient.prototype.query = function (queryString, callback) {
        var self = this;
        this.acquire(function (connectErr, client) {
            if (connectErr) {
                callback(connectErr);
                return;
            }
            client.ZuoraService.Soap.query({queryString: queryString}, self.handleQueryResponse.bind(self, callback));
        });
    };
    ZuoraSoapClient.prototype.create = function (data, callback) {
        var self = this;
        this.acquire(function (connectErr, client) {
            if (connectErr) {
                callback(connectErr);
                return;
            }
            client.ZuoraService.Soap.create(self.handleUpdateRequest(data), self.handleUpdateResponse.bind(self, callback));
        });
    };
    ZuoraSoapClient.prototype.update = function (data, callback) {
        var self = this;
        this.acquire(function (connectErr, client) {
            if (connectErr) {
                callback(connectErr);
                return;
            }
            client.ZuoraService.Soap.update(self.handleUpdateRequest(data), self.handleUpdateResponse.bind(self, callback));
        });
    };
    ZuoraSoapClient.prototype.delete = function (type, ids, callback) {
        var self = this;
        this.acquire(function (connectErr, client) {
            if (connectErr) {
                callback(connectErr);
                return;
            }
            if (typeof ids === 'string') {
                ids = [ids];
            }
            client.ZuoraService.Soap.delete({type: type, ids: ids}, callback);
        });
    };
    return ZuoraSoapClient;
})();

module.exports = new ZuoraSoapClient();