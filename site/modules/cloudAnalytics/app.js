'use strict';
var vasync = require('vasync');
var config = require('easy-config');
config.cloudAnalytics = config.cloudAnalytics || {
    instrumentationTTL: 10000
};

// default heatmap values for different requests
var HEATMAP_WIDTH = 580;
var HEATMAP_HEIGHT = 180;
var HEATMAP_NBUCKETS = 25;
var HEATMAP_DURATION = 60;
var HEATMAP_HUES = 21;

var metrics = null;

function InstrumentationCache() {}

InstrumentationCache.prototype = {
    findById: function (zoneId, id) {
        var result = [];
        this.forEach(zoneId, function (instrumentation) {
            if (+instrumentation.id === +id) {
                result.push(instrumentation);
            }
        });
        return result;
    },
    keyById: function (zoneId, id) {
        var instrumentation = this.findById(zoneId, id)[0];
        return instrumentation && instrumentation.key;
    },
    length: function (zoneId) {
        //noinspection JSLint
        return zoneId ? Object.keys(Object(this[zoneId])).length : Object.keys(this).length;
    },
    forEach: function (zoneId, callback) {
        var k;
        //noinspection JSLint
        var keys = Object.keys(Object(this[zoneId]));
        for (k = 0; k < keys.length; k += 1) {
            callback(this[zoneId][keys[k]], k);
        }
    },
    toArray: function (zoneId) {
        var array = [];
        this.forEach(zoneId, function (instrumentation) {
            array.push(instrumentation);
        });
        return array;
    }
};
var instrumentationCache = new InstrumentationCache();

function createCacheKey(instrumentationConfig) {
    return [
        instrumentationConfig.module,
        instrumentationConfig.stat,
        instrumentationConfig.decomposition.join(':')
    ].join(':');
}

function recreateOnError(instrumentation, err) {
    if (!err || err.statusCode !== 404) {
        return false;
    }
    instrumentation.initialized = false;
    instrumentation.options.isNew = true;
    instrumentation.init(function (error) {
        if (error) {
            instrumentation.broken = true;
            instrumentation.cloud.log.error(error);
            instrumentation.destroy();
        }
    });

    return true;
}

function Instrumentation(cloud, options) {
    var key = createCacheKey(options.config);
    var cache = instrumentationCache[options.machineId] = instrumentationCache[options.machineId] || {};
    if (cache[key]) {
        return cache[key];
    }

    this.cloud = cloud;
    this.config = options.config;
    this.options = options;
    this.id = options.config.id || null;
    this.key = key;
    this.machineId = options.machineId;
    this.datacenter = options.datacenter;
    this.timeout = null;
    this.initialized = false;
    this.broken = false;
    this.lastUpdate = null;
    cache[key] = this;
    return this;
}

Instrumentation.prototype.init = function (callback) {
    this.ping();
    var self = this;
    if (this.initialized) {
        callback(null, this);
        return;
    }
    if (this.options.isNew) {
        this.cloud.createInstrumentation(this.config, function (error, instrumentation) {
            if (error) {
                self.broken = true;
                callback(error);
                return;
            }
            self.id = +instrumentation.id;
            self.config = instrumentation;
            self.initialized = true;
            callback(null, self);
        });
    } else {
        this.id = +this.config.id;
        this.initialized = true;
        callback(null, this);
    }
};

Instrumentation.prototype.ping = function () {
    if (this.broken) {
        return;
    }
    var self = this;
    if (this.timeout) {
        clearTimeout(this.timeout);
    }
    // if instrumentation isn't used 10 sec(default) - it should be removed
    this.timeout = setTimeout(self.destroy.bind(self), config.cloudAnalytics.instrumentationTTL || 10000);
};

Instrumentation.prototype.getValue = function (callback) {
    if (!this.initialized) {
        callback(null, []);
        return;
    }
    if (this.broken) {
        callback('Instrumentation is broken');
        return;
    }
    this.ping();
    var self = this;
    var arity = this.config['value-arity'];
    var method = 'getInstrumentationValue';
    var options = {
        id: this.id,
        start_time: (this.lastUpdate || Math.floor(this.config.crtime / 1000))
    };

    if (arity === 'numeric-decomposition') {
        method = 'getInstrumentationHeatmap';
        options.width = this.config.width || HEATMAP_WIDTH;
        options.height = this.config.height || HEATMAP_HEIGHT;
        options.nbuckets = this.config.nbuckets || HEATMAP_NBUCKETS;
        options.duration = this.config.duration || HEATMAP_DURATION;
        options.hues = this.config.hues || HEATMAP_HUES;
        options.ndatapoints = 1;
        options.end_time = options.start_time;
        delete options.start_time;
    }

    this.cloud[method](options, options, function (error, response) {
        if (error || !response) {
            if (recreateOnError(self, error)) {
                callback(null, {});
                return;
            }
            callback(error);
            return;
        }

        self.lastUpdate = (response.end_time || self.lastUpdate);

        if (arity === 'numeric-decomposition') {
            response.end_time += self.config.duration || HEATMAP_DURATION;
        }

        callback(error, response);
    });
};

Instrumentation.prototype.getHeatmap = function (options, callback) {
    var self = this;
    if (!this.initialized) {
        callback(null, []);
        return;
    }
    if (this.broken) {
        callback('Instrumentation is broken');
        return;
    }
    this.ping();
    this.cloud.getInstrumentationHeatmapDetails(options, options, function (error, heatmap) {
        if (recreateOnError(self, error)) {
            callback(null, []);
            return;
        }
        callback(error, heatmap);
    });
};

Instrumentation.prototype.destroy = function (callback) {
    callback = callback || function () {};
    var cache = instrumentationCache[this.machineId] || {};
    delete cache[this.key];

    if (this.timeout) {
        clearTimeout(this.timeout);
    }
    if (!this.initialized || this.broken) {
        callback(null, {});
        return;
    }

    this.broken = true;
    this.cloud.deleteInstrumentation(this.id, callback);
};

Instrumentation.prototype.toJSON = function () {
    return this.config;
};

Instrumentation.prototype.valueOf = function () {
    return this.config;
};

module.exports = function execute(scope, app) {
    var info = scope.api('Info');

    app.get('/ca', function (req, res) {
        if (metrics) {
            res.json({error: null, res: metrics});
            return;
        }
        req.cloud.describeAnalytics(function (err, _metrics) {
            if (err) {
                req.log.warn(err);
                err = 'Failed to get Cloud Analytics metrics';
            } else {
                metrics = _metrics;
                metrics.help = info.ca_help.data;
            }
            res.json({error: err, res: metrics});
        });
    });

    function createInstrumentations(isNew, cloud, machineId, configs, callback) {
        vasync.forEachParallel({
            inputs: configs || [],
            func: function (options, cb) {
                var instrumentation = new Instrumentation(cloud, {
                    machineId: machineId,
                    config: options,
                    isNew: isNew
                });
                instrumentation.init(cb);
            }
        }, function (error, response) {
            callback(error, response.successes);
        });
    }

    /**
     * Get all instrumentations, specified to machine
     */
    app.get('/ca/:datacenter/:zoneId/describeInstrumentations', function (req, res) {
        function getZoneId(options) {
            var params = (options.predicate && options.predicate.eq) || [];
            return params[0] === 'zonename' ? params[1] : '*';
        }

        req.cloud.separate(req.params.datacenter).listInstrumentations(function (error, instrumentationConfigs) {
            var configs = [];
            if (error) {
                res.json({error: error, res: []});
                return;
            }
            instrumentationConfigs.forEach(function (options) {
                var zoneId = getZoneId(options);
                if (zoneId === req.params.zoneId || zoneId === '*') {
                    configs.push(options);
                }
            });
            createInstrumentations(false, req.cloud.separate(req.params.datacenter), req.params.zoneId, configs,
                function (err, result) {
                    res.json({error: err, res: result});
                });
        });
    });

    /**
     * get machine instrumentation values
     */
    app.get('/ca/:datacenter/:zoneId/instrumentations', function (req, res) {
        vasync.forEachParallel({
            inputs: instrumentationCache.toArray(req.params.zoneId),
            func: function (instrumentation, callback) {
                instrumentation.getValue(function (error, response) {
                    var result = {
                        id: instrumentation.id,
                        value: null
                    };

                    if (error) {
                        req.log.error(error);
                    }
                    if (response) {
                        result.value = response;
                    }
                    callback(error, result);
                });
            }
        }, function (error, response) {
            res.json({error: error, res: response.successes});
        });
    });

    /**
     * get instrumentation heatmap
     */
    app.post('/ca/:datacenter/:zoneId/getHeatmap', function (req, res) {
        var instrumentation = instrumentationCache.findById(req.params.zoneId, req.body.id)[0];

        if (!instrumentation) {
            res.json({error: 'instrumentation not found', res: []});
            return;
        }

        var options = {
            id: +req.params.id,
            ymax: req.body.ymax,
            ymin: req.body.ymin,
            width: req.body.width || HEATMAP_WIDTH,
            height: req.body.height || HEATMAP_HEIGHT,
            nbuckets: req.body.nbuckets || HEATMAP_NBUCKETS,
            duration: req.body.duration || HEATMAP_DURATION,
            ndatapoints: 1,
            end_time: req.body.endtime,
            x: req.body.x,
            y: req.body.y
        };

        instrumentation.getHeatmap(options, function (error, response) {
            res.json({error: error, res: response});
        });
    });
    /**
     * create instrumentations
     */
    app.post('/ca/:datacenter/:zoneId/instrumentations', function (req, res) {
        createInstrumentations(true, req.cloud.separate(req.params.datacenter), req.params.zoneId, req.body,
            function (error, result) {
                res.json({error: error, res: result});
            });
    });
    /**
     * delete instrumentation
     */
    app.del('/ca/:datacenter/:zoneId/:id', function (req, res) {
        vasync.forEachParallel({
            inputs: instrumentationCache.findById(req.params.zoneId, req.params.id),
            func: function (instrumentation, callback) {
                instrumentation.destroy(callback);
            }
        }, function (error, response) {
            res.json({error: error, res: response.successes});
        });
    });
    /**
     * delete all machine instrumentations
     */
    app.del('/ca/:datacenter/:zoneId', function (req, res) {
        vasync.forEachParallel({
            inputs: instrumentationCache.toArray(req.params.zoneId),
            func: function (instrumentation, callback) {
                instrumentation.destroy(callback);
            }
        }, function (error) {
            res.json({error: error, res: true});
        });
    });
};
