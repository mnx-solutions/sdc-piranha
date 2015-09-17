'use strict';

(function (app) {
    app.factory('DockerCacheProvider', [
        function () {

            function cache(options) {
                this.index = {};
                this.list = [];
                this.size = 0;
                this.cacheKey = options && options.key || 'Id';
                this.secondaryKey = options && options.secondaryKey || null;
                this.initialized = false;
            }

            cache.prototype.put = function (value) {
                if (!value) {
                    return;
                }
                var list = this.list;
                var cacheKey = this.cacheKey;
                var secondaryKey = this.secondaryKey;
                var key = value[cacheKey];
                if (key in this.index) {
                    this.list = list.map(function (item) {
                        if (item[cacheKey] === value[cacheKey]) {
                            if (!secondaryKey || item[secondaryKey] === value[secondaryKey]) {
                                item = value;
                            }
                        }
                        return item;
                    });
                } else {
                    this.size++;
                    list.push(value);
                }
                this.index[key] = value;
                return value;
            };

            cache.prototype.replace = function (items) {
                if (!Array.isArray(items)) {
                    return;
                }
                var cacheKey = this.cacheKey;
                this.size = items.length;
                this.list = items;
                var index = {};
                this.list.forEach(function (item) {
                    var key = item[cacheKey];
                    index[key] = item;
                });
                this.index = index;
                this.initialized = true;
            };

            cache.prototype.get = function (key) {
                return key ? this.index[key] : undefined;
            };

            cache.prototype.remove = function (key) {
                if (!(key && this.size)) {
                    return;
                }
                if (key in this.index) {
                    delete this.index[key];
                    var cacheKey = this.cacheKey;
                    this.list = this.list.filter(function (item) {
                        return item[cacheKey] !== key;
                    });
                    this.size--;
                }
            };

            cache.prototype.reset = function () {
                this.size = 0;
                this.list = [];
                this.index = {};
                this.initialized = false;
            };

            return cache;
        }]);
}(window.JP.getModule('docker')));

