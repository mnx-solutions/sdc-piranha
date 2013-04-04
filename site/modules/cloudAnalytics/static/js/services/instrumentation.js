'use strict';

var instrumentations = {};

(function (ng, app) {
    app.factory('caInstrumentation', ['$resource', '$timeout', '$http', 'MD5', function ($resource, $timeout, $http, MD5) {
        var url = 'cloudAnalytics/ca/instrumentations';
//        var instrumentations = {};

        function DataSet(opts) {
            if(!(this instanceof DataSet)) {
                return new DataSet(opts);
            }
            opts = opts || {};

            this.startTime = opts.startTime || (Math.floor(Date.now()/1000));
            this.values = {};
            this.map = {};
            this.ask = {};
            this.endTime = this.startTime + 1;
        }

        DataSet.prototype.addValues = function (data) {
            var self = this;
            data.forEach(self.addValue.bind(self));
            self.ask = {};
        };

        DataSet.prototype.addValue = function (value) {
            var self = this;
            if(ng.isObject(value.value)){
                Object.keys(value.value).forEach(function(k) {
                    if(!self.map[k]) {
                        self.map[k] = {};
                    }
                    self.map[k][value.start_time + ''] = value.value[k];
                    self.endTime = value.start_time;
                });
            } else if(value.value === +value.value) {
                if(!self.map['default']) {
                    self.map['default'] = {};
                }
                self.map['default'][value.start_time + ''] = value.value;
                self.endTime = value.start_time;
            } else {
                console.warn(value);
            }
        };

        DataSet.prototype.getValues = function (id, timeframe, series) {
            var self = this;

            if(+timeframe === timeframe) {
                timeframe = {
                    nr: +timeframe,
                    endTime: self.endTime
                };
            }
            var ret = {};

            if(!series) {
                series = Object.keys(self.map);
            }
            ret._timestamps = [];
            var i;
            for(i = 0; i < timeframe.nr; i++) {
                ret._timestamps.unshift(timeframe.endTime - i);
            }
            series.forEach(function(k) {
                ret[k] = [];
                ret._timestamps.forEach(function (ts){
                    ret[k].push(self.map[k][ts] || 0);
                });
            });
            self.ask[id] = true;

            return ret;
        };

        DataSet.prototype.hasChanged = function (id) {
            return !this.ask[id];
        };

        function Instrumentation(uuid, opts) {
            if(!(this instanceof Instrumentation)) {
                return new Instrumentation(uuid, opts);
            }
            var self = this;

            self._uuid = uuid;
            self._createOpts = opts.createOpts;
            self._parent = opts.parent;

        }

        Instrumentation.prototype.getUrl = function () {
            var self = this;

            return  url + '/' + self.id;
        };

        Instrumentation.prototype.init = function (data, callback) {
            var self = this;

            callback = (callback || ng.noop);
            if(data) {
                Object.keys(data).forEach(function (k) {
                    self[k] = data[k];
                });

                self._data = new DataSet({startTime: data.crtime});
                setTimeout(callback, 1);
            } else {
                $http({
                    method:'POST',
                    url: url,
                    data: self._createOpts
                })
                .success(function (data) {
                    Object.keys(data).forEach(function (k) {
                        self[k] = data[k];
                    });
                    self._data = new DataSet({startTime: data.crtime});
                    callback();
                })
                .error(function (err) {
                    console.log('error');
                    self._err = err;
                    callback(err);
                });
            }
        };

        Instrumentation.prototype.delete = function (callback) {
            callback = (callback || ng.noop);
            var self = this;
            $http({ method: 'DELETE', url: self.getUrl() })
                .success(function() {
                    console.log('success');
                    callback();
                })
                .error(function() {
                    console.log('error');
                    callback();
                });

        };

        Instrumentation.prototype.addValues = function () {
            return this._data.addValues.apply(this._data, arguments);
        };

        Instrumentation.prototype.getValues = function () {
            return this._data.getValues.apply(this._data, arguments);
        };

        Instrumentation.prototype.hasChanged = function (id) {
            return this._data.hasChanged(id);
        };

        Instrumentation.prototype.clone = function (opts) {
            var self = this;

        };

        function _getUUID(opts) {
            return MD5(ng.toJson(opts.createOpts));
        }

        var service = {};

        service.create = function(opts, callback) {
            var uuid = _getUUID(opts);
            if(!instrumentations[uuid]) {
                var inst = new Instrumentation(uuid, opts);
                instrumentations[uuid] = inst;

                inst.init(opts.init, function (err) {
                    callback(err, inst);
                });
            } else {
                setTimeout(function() {
                    callback(null, instrumentations[uuid]);
                }, 1);
            }
        };

        service.map = function() {
            return instrumentations;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('cloudAnalytics')));