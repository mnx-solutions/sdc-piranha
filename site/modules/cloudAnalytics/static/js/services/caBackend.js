'use strict';


(function (app) {
    app.factory('caBackend', ['$resource', '$timeout', '$http', 'caInstrumentation', function ($resource, $timeout, $http, instrumentation) {

        var ca = function(){};
        ca.options = {
            last_poll_time: null,
            ndatapoints: 1,
            individual: {}
        }
        ca.request_time = null;
        ca.instrumentations = {};
        ca.conf = $http.get('/cloudAnalytics/ca');

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
            $http.post('/cloudAnalytics/ca/getInstrumentations', {options: ca.options}).success(function(res){

                ca.options.last_poll_time = res.end_time;

                var datapoints = res.datapoints;
                for(var id in datapoints) {
                    ca.instrumentations[id].addValues(datapoints[id]);
                }

                var now = Math.floor((new Date()).getTime() / 1000);
                var difference = now - ca.request_time;
                ca.request_time = now;

                // if there's no difference in time, ask 1 datapoint;
                ca.options.ndatapoints = difference || 1;

                pending = false;
            });
        }
        ca._sync = function(){
            if (Object.keys(ca.instrumentations).length) {
                if (!pending) {
                    pending = true;
                    ca.request_time = Math.floor((new Date()).getTime() / 1000);
                    ca._poll();
                }
            }
            $timeout(ca._sync, 1000);
        }
        ca._sync();


        // The part of service which will be exposed and gets instanciated
        var id = 0;
        function service() {
            this.id = id++;
            this.instrumentations = {};

            // view options
            this.range = 60;
            this.width = 640;
            this.height = 200;

        };

        service.prototype.changeRange = function(range) {
            this.range = range;
        }

        service.prototype.changeWidth = function(width) {
            this.width = width;
        }

        service.prototype.describeCa = function(cb) {
            var self = this;

            ca.conf.then(function(conf) {
                self.conf = conf.data;
                cb(conf.data);
            });

        };
        service.prototype.createInstrumentation  = function(createOpts, cb) {

            var self = this;
            instrumentation.create({
                createOpts: createOpts,
                parent:ca
            }, function(err, inst){

                var heatmap = inst['value-arity'] === 'numeric-decomposition';

                self.instrumentations[inst.id] = {
                    range: self.range,
                    'value-arity': inst['value-arity'],
                    crtime: Math.floor(inst.crtime /1000)
                };

                ca.instrumentations[inst.id] = inst;

                // set options for polling values
                var options = {
                    'value-arity': inst['value-arity'],
                    crtime: Math.floor(inst.crtime /1000)
                }
                if(heatmap) {
                    options.ndatapoints = self.range;
                    options.width = self.width;
                    options.height = self.height;
                }
                ca.options.individual[inst.id] = options;

                cb(inst)

            });

        }
        service.prototype.createInstrumentations = function(createOpts, cb) {
            var insts = [];
            var self = this;
            for(var opt in createOpts) {
                self.createInstrumentation(createOpts[opt], function(inst){
                    insts.push(inst);
                    if(createOpts.length == insts.length){
                        cb(insts);
                    }
                })
            }
        }

        service.prototype.deleteInstrumentation = function(i) {
            i.delete();
        }
        service.prototype.getSeries = function(insts, time) {

            var seriesCollection = [];
            var self = this;
            for(var i in insts) {
                var instrumentation = insts[i];
                var id = instrumentation.id;
                var heatmap = instrumentation['value-arity'] === 'numeric-decomposition';

                var series = instrumentation.getValues(self.id, {
                    nr: self.range,
                    endTime: time
                });

                var times = series._timestamps;
                delete series._timestamps;

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

                    self.instrumentations[id].heatmap = hms;

                    seriesCollection.push({
                        name: name,
                        data: data,
                        color: ca.getColor(name)
                    });

                }

            }

            return seriesCollection;
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
