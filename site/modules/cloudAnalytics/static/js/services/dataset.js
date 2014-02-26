'use strict';

(function (app, ng) {
    app.factory('ca.dataset', [
        function () {
            function DataSet(opts) {
                if (!(this instanceof DataSet)) {
                    return new DataSet(opts);
                }
                opts = opts || {};

                this.startTime = opts.startTime || Math.floor(Date.now() / 1000);
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
            DataSet.prototype.getValue = function (time) {
                if (this.map['default'] && this.map['default'][time.toString()]) {
                    return this.map['default'][time.toString()];
                }
                return false;
            };
            DataSet.prototype.addValue = function (value) {
                var self = this;

                if (value.image) {
                    if (!self.map['default']) {
                        self.map['default'] = {};
                    }
                    self.map['default'][value.end_time.toString()] = {
                        hm  : value.image,
                        ymax: value.ymax,
                        ymin: value.ymin
                    };
                    self.endTime = value.end_time + 1;
                } else if (ng.isObject(value.value)) {
                    Object.keys(value.value).forEach(function (k) {
                        if (!self.map[k]) {
                            self.map[k] = {};
                        }
                        self.map[k][value.start_time.toString()] = value.value[k];
                        self.endTime = value.start_time;
                    });
                } else if (value.value === +value.value) {
                    if (!self.map['default']) {
                        self.map['default'] = {};
                    }
                    self.map['default'][value.start_time.toString()] = value.value;
                    self.endTime = value.start_time;
                } else {
                    console.warn(value);
                }
            };

            DataSet.prototype.getValues = function (id, timeframe, series) {
                var self = this;

                if (+timeframe === timeframe) {
                    timeframe = {
                        nr     : +timeframe,
                        endTime: self.endTime
                    };
                }
                var ret = {};
                Object.defineProperty(ret, '_timestamps', {value: [], writable: true});
                Object.defineProperty(ret, '_behind', {value: self.endTime - timeframe.endTime});

                if (!series) {
                    series = Object.keys(self.map);
                }
                ret._timestamps = [];

                var i;
                for (i = 0; i < timeframe.nr; i++) {
                    ret._timestamps.unshift(timeframe.endTime - i);
                }
                series.forEach(function (k) {
                    ret[k] = [];
                    ret._timestamps.forEach(function (ts) {
                        ret[k].push(self.map[k][ts] || 0);
                    });
                });
                self.ask[id] = true;

                return ret;
            };

            DataSet.prototype.hasChanged = function (id) {
                return !this.ask[id];
            };

            return DataSet;
        }
    ]);
})(window.JP.getModule('cloudAnalytics'), angular);
