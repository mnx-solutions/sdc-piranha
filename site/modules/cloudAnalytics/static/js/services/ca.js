'use strict';


(function (app) {
    app.factory('ca', ['$resource', '$http', 'caInstrumentation',
        function ($resource, $http, instrumentation) {

        var _pollOptions = {
            last_poll_time: null,
            individual: {},
            ndatapoints: 1
        };
        _pollOptions.update = function(serverResponse) {

            var datapoints = serverResponse.datapoints;
            this.last_poll_time = serverResponse.end_time;


            var now = Math.floor((new Date()).getTime() / 1000);
            var difference = now - ca.request_time;

            for(var datacenter in datapoints) {
                for (var id in datapoints[datacenter]) {
                    if(datapoints[datacenter][id].err){
                        continue;
                    }
                    var instrumentation = ca.instrumentations.getInstrumentation(datacenter, id);

                    if(datapoints[datacenter][id].blocked) {
                        var previous = this.individual[datacenter][id].ndatapoints || this.ndatapoints;
                        this.individual[datacenter][id].ndatapoints = previous + (difference || 1);
                    } else if(instrumentation) {
                        delete(this.individual[datacenter][id].ndatapoints);
                        instrumentation.addValues(datapoints[datacenter][id]);
                    }
                }
            }

            ca.request_time = now;

            // if there's no difference in time, ask 1 datapoint;
            this.ndatapoints = difference || 1;

        };
        _pollOptions.changeRange = function (inst) {
            this.individual[inst._datacenter][inst.id].duration = range;
        }
        _pollOptions.remove = function (inst) {
            delete(this.individual[inst._datacenter][inst.id]);
        };
        _pollOptions.removeAll = function () {
            this.last_poll_time = null;
            this.individual = {};
            this.ndatapoints = 1;
        };

        _pollOptions.getSendValues = function () {
            return {
                last_poll_time: this.last_poll_time,
                individual: this.individual,
                ndatapoints: this.ndatapoints
            }
        };

        _pollOptions.addOptions = function (inst, createOpts, instance) {
            var self = this;
            // set options for polling values
            var options = {
                'value-arity': inst['value-arity'],
                crtime: createOpts.pollingstart || Math.floor(inst.crtime /1000),
                datacenter: inst._datacenter
            }
            // if heatmap, add heatmap-specific options
            if(inst['value-arity'] === 'numeric-decomposition') {
                options.ndatapoints = createOpts.range || instance.range;
                options.width = instance.width;
                options.height = instance.height;
            }
            if(!self.individual[inst._datacenter]) {
                self.individual[inst._datacenter] = {};
            }
            self.individual[inst._datacenter][inst.id] = options;
        }










        var _instrumentations = {
            private: {},
            public: {},
            listUrl: 'cloudAnalytics/ca/instrumentations'

        };
        _instrumentations.getInstrumentation = function (datacenter, id) {
            if(this.public[datacenter] && this.public[datacenter][id]) {
                return this.public[datacenter][id];
            }

            if(this.private[datacenter] && this.private[datacenter][id]) {
                return this.private[datacenter][id];
            }

            return false;
        };
        _instrumentations._getStatLabel = function (stat) {
            for(var m in ca.description.confReady.metrics) {
                var metric = ca.description.confReady.metrics[m];
                if(metric.stat == stat) {
                    return metric.label;
                }
            }
            return false;
        }
        _instrumentations._getDecompositionLabels = function (decompositions) {
            var response = [];
            for(var d in decompositions) {
                var decomposition = decompositions[d];
                response.push(ca.description.confReady.fields[decomposition].label);
            }
            return response;
        }
        _instrumentations._getMetricLabel = function (mod, stat) {
            for( var m in ca.description.confReady.metrics) {
                var metric = ca.description.confReady.metrics[m];
                if(metric.module === mod && metric.stat === stat) {
                    return metric.labelHtml;
                }
            }
            return false;
        }
        _instrumentations._createTitle = function (inst) {
            var self = this;
            var graphtitle = self._getMetricLabel(inst.module, inst.stat);

            if(inst.decomposition && inst.decomposition.length) {
                graphtitle += ' decomposed by ';
                graphtitle += self._getDecompositionLabels(inst.decomposition).join(' and ');
            }
            inst.graphtitle = graphtitle;
        };
        _instrumentations._add = function (collection, inst) {
            if(!this[collection][inst._datacenter]) {
                this[collection][inst._datacenter] = {};
            }

            this._createTitle(inst);

            this[collection][inst._datacenter][inst.id] = inst;
        };
        _instrumentations.addPrivate = function (inst) {
            this._add('private', inst);
        };
        _instrumentations.add = function (inst) {
            this._add('public', inst);
        };
        _instrumentations.remove = function (inst) {
            if(this.public[inst._datacenter] && this.public[inst._datacenter][inst.id]) {
                delete(this.public[inst._datacenter][inst.id]);
                if(!Object.keys(this.public[inst._datacenter]).length) {
                    delete(this.public[inst._datacenter]);
                }
                inst.remove(function(){

                });
            }
        };
        _instrumentations.removePrivate = function (inst) {
            if(this.private[inst._datacenter] && this.private[inst._datacenter][inst.id]) {
                delete(this.private[inst._datacenter][inst.id]);
                if(!Object.keys(this.private[inst._datacenter]).length) {
                    delete(this.private[inst._datacenter]);
                }
            }
        };
        _instrumentations.removeAll = function () {
            for(var datacenter in this.public) {
                for(var id in this.public[datacenter]) {
                    this.public[datacenter][id].remove(function(){

                    })
                }
            }
            this.public = {};
        };
        _instrumentations.isEmpty = function () {
            return !Object.keys(this.public).length;
        };

        _instrumentations.listInstrumentations = function (callback) {
            var self = this;
            var list = $http.get(self.listUrl);

            list.then(function(r) {
                if(typeof(r.data.time) != 'undefined' && typeof(r.data.instrumentations) != 'undefined') {
                    callback(null, r.data.time, r.data.instrumentations);
                } else {
                    callback('error retrieving list of instrumentations');
                }
            });
        }

        _instrumentations.getSeries = function (insts, time, service) {
            var seriesCollection = [];
            var self = this;

            for(var i in insts) {
                var instrumentation = insts[i];

                var id = instrumentation.id;
                var datacenter = instrumentation._datacenter;
                var heatmap = instrumentation['value-arity'] === 'numeric-decomposition';
                var serviceOptions = service.instrumentations[datacenter][id];
                if(!serviceOptions) {
                    continue;
                }
                var series = instrumentation.getValues(service.id, {
                    nr: serviceOptions.range || service.range,
                    endTime: time
                });

                var times = series._timestamps;
                series._timestamps = undefined;

                for(var name in series) {
                    var data = [];
                    var hms;

                    for(var dp in series[name]) {

                        var y = (heatmap ? 0 : series[name][dp]);

                        if(series[name][dp] !== 0) {
                            hms = series[name][dp];
                        }

                        data.push({
                            x:times[dp],
                            y:y
                        });
                    }

                    service.instrumentations[datacenter][id].heatmap = hms;

                    var gName = name;
                    if(name === 'default' && instrumentation.stat) {
                        gName = ca.instrumentations._getStatLabel(instrumentation.stat);
                    }

                    seriesCollection.push({
                        name: gName,
                        data: data,
                        color: ca.getColor(gName)
                    });
                    if(!seriesCollection.length) {
                        var data = [];
                        var range = serviceOptions.range || service.range;
                        var endtime = times[times.length-1];
                        for(var i = range; range >= 0; --range ) {
                            data.push({
                                x:endtime-range,
                                y:0
                            })
                        }
                        seriesCollection.push({
                            name: 'default',
                            data: data,
                            color: ca.getColor('default')
                        })
                    }

                }

            }
            return seriesCollection;
        }









        var _description = {
            help: $http.get('cloudAnalytics/ca/help'),
            conf: $http.get('cloudAnalytics/ca'),
            confReady: null,
            helpReady: null
        };
        _description._labelMetrics = function (metric) {
            var fieldsArr = metric.fields;
            var labeledFields = [];
            for(var f in fieldsArr) {
                labeledFields[fieldsArr[f]] = ca.description.confReady.fields[fieldsArr[f]].label;
            }
            metric.fields = labeledFields;
            var moduleName = ca.description.confReady.modules[metric.module].label;
            metric.labelHtml = moduleName + ': ' + metric.label;

            return metric;
        };

        _description.describe = function(callback) {

            var self = this;
            if(self.confReady && self.helpReady) {
                if(!self.confReady.help) {
                    self.confReady.help = self.helpReady;
                }
                callback(null, self.confReady);
                return;
            }
            var count = 0;
            self.conf.then(function(r){
                self.confReady = r.data;
                count++;
                if(count === 2) {
                    if(!self.helpReady || !self.confReady) {
                        callback({
                            message: 'configuration not loaded!'
                        });
                        return
                    }

                    if(!self.confReady.help) {
                        self.confReady.help = self.helpReady;
                    }
                    self.confReady.metrics.forEach(self._labelMetrics);
                    callback(null, self.confReady);
                    return;
                }
            });

            self.help.then(function(r){
                self.helpReady = r.data.data;
                count++;
                if(count === 2) {
                    if(!self.helpReady || !self.confReady) {
                        callback({
                            message: 'configuration not loaded!'
                        });
                        return
                    }

                    if(!self.confReady.help) {
                        self.confReady.help = self.helpReady;
                    }
                    self.confReady.metrics.forEach(self._labelMetrics);
                    callback(null, self.confReady);
                    return;
                }
            })
        };

        var ca = function(){};
        ca.request_time = null;
        ca.options = _pollOptions;
        ca.instrumentations = _instrumentations;
        ca.description = _description;


        // manage graph colors.
        var palette = new Rickshaw.Color.Palette( { scheme: 'colorwheel' } );
        ca.usedColors = {
            'default':'steelblue'
        };
        ca.getColor = function(key) {
            if(ca.usedColors[key]) {
                return ca.usedColors[key];
            } else {
                ca.usedColors[key] = palette.color();
                return ca.usedColors[key];
            }
        }

        // Poll all the instrumentation values.
        var pending = false;
        ca._poll = function() {

            $http.post('cloudAnalytics/ca/getInstrumentations', {options: ca.options.getSendValues()}).success(function(res){
                if (res.err) {
                    //TODO: error handling
                } else {
                    ca.options.update(res);
                }
                pending = false;
            });
        }
        ca._sync = function(){
            if (!ca.instrumentations.isEmpty()) {
                if (!pending) {
                    pending = true;
                    ca.request_time = Math.floor((new Date()).getTime() / 1000);
                    ca._poll();
                }
            }
            setTimeout(ca._sync, 1000);
        }
        ca._sync();


        // The part of service which will be exposed and gets instanciated
        var id = 0;
        function service() {
            this.id = id++;
            this.instrumentations = {};
            this.deletequeue = [];
            // view options
            this.range = 60;
            this.width = 570;
            this.height = 180;

        };

        service.prototype.changeRange = function(is, range) {
            if(this.instrumentations[is[0]._datacenter][is[0].id].heatmap) {
                ca.options.changeRange(is[0], range);
            }
            this.instrumentations[is[0]._datacenter][is[0].id].range = range;
        }

        service.prototype.describeCa = function(cb) {
            ca.description.describe(cb);
        };


        service.prototype.createInstrumentation  = function(createOpts, cb) {

            if(!createOpts.init) {
                createOpts.init = null;
            }
            var self = this;
            instrumentation.create({
                createOpts: createOpts,
                init: createOpts.init,
                parent:ca
            }, function(err, inst){
                if(!err) {

                    ca.instrumentations.add(inst);
                    if(!self.instrumentations[inst._datacenter]) {
                        self.instrumentations[inst._datacenter] = {};
                    }
                    self.instrumentations[inst._datacenter][inst.id] = {
                        graphtitle: inst.graphtitle,
                        range: createOpts.range || self.range,
                        'value-arity': inst['value-arity'],
                        crtime: Math.floor(inst.crtime /1000)
                    };

                    ca.options.addOptions(inst, createOpts, self);

                    cb(err, inst)

                } else {
                    console.log('err', err);
                    cb(err, inst);
                }

            });
        }
        service.prototype.cleanup = function (i) {
            delete(this.instrumentations[i._datacenter][i.id]);
            ca.options.remove(i);
            ca.instrumentations.remove(i);
        }
        service.prototype.getHeatmapDetails = function(options, cb){

//            instrumentation: $scope.instrumentations[0],
//            endtime: heatmaptime
        }
        service.prototype.createInstrumentations = function(createOpts, cb) {
            var insts = [];
            var errors = [];
            var self = this;
            for(var opt in createOpts) {
                self.createInstrumentation(createOpts[opt], function(err, inst){
                    if(!err){
                        insts.push(inst);
                    } else {
                        errors.push(err);
                    }
                    if(createOpts.length == insts.length + errors.length){
                        cb(errors, insts);
                    }
                })
            }
        }

        service.prototype.deleteInstrumentation = function(i) {

            for(var inst in this.deletequeue) {
                var qu = this.deletequeue[inst];
                if (qu.id === i.id && qu._datacenter === i._datacenter ) {
                    return false;
                }
            }
            return this.deletequeue.push(i);
        }

        service.prototype.deleteInstrumentations = function(is) {
            var self = this;
            for(var i in is) {
                self.deleteInstrumentation(is[i]);
            }
        }
        service.prototype.getSeries = function(insts, time) {
            var self = this;

            var series = ca.instrumentations.getSeries(insts, time, self);

            return series;
        }

        service.prototype.polltime = function() {
            return ca.options.last_poll_time;
        }
        service.prototype.deleteAllInstrumentations = function() {

            this.instrumentations = {};
            ca.options.removeAll();
            ca.instrumentations.removeAll();
        }

        service.prototype.listAllInstrumentations = function(cb) {

            var self = this;
            ca.instrumentations.listInstrumentations(function(err, time, rawInstrs){
                if(err) {
                    cb(err);
                    return;
                }
                var count = rawInstrs.length;
                if(!rawInstrs.length) {
                    cb(null, time, rawInstrs);
                    return;
                }
                var instrumentations = [];
                var errors = [];
                for(var i in rawInstrs) {
                    var rawInst = rawInstrs[i];

                    if(!ca.options.last_poll_time){
                        ca.options.last_poll_time = time;
                    }
                    self.createInstrumentation({
                        init: rawInst,
                        pollinstart: time
                    }, function (err2, inst) {
                        count--;
                        if(err2) {
                            errors.push(err2);
                        } else {
                            instrumentations.push(inst);
                        }

                        if(!count) {
                            if(!errors.length) {
                                errors = null;
                            }
                            cb(errors, time, instrumentations);
                        }
                    })


                }

            });
        }

        service.prototype.hasChanged = function (inst){
            return inst.hasChanged(this.id);
        }
        service.prototype.hasAnyChanged = function (insts){
            var changed = false;
            for(var i in insts) {
                if(insts[i].hasChanged(this.id)) {
                    changed = true;
                }
            }
            return changed;
        }
        return service;
    }]);


}(window.JP.getModule('cloudAnalytics')));
