'use strict';


(function (app) {
    app.factory('caBackend', ['$resource', '$timeout', '$http', function ($resource, $timeout, $http) {
        var instrumentations = {};
        var instrumentation = $resource('/cloudAnalytics/ca/instrumentations/:id', {id:'@id'}, {
            clone: {method:'POST', params:{clone: '@id'}}
        });

        var local = 0;
        var remote = 0;
        var noRequest = true;

        var poll = function() {
            noRequest = false;
            $http.post('/cloudAnalytics/ca/getInstrumentations', {instrumentations: instrumentations}).success(function(allVals){
                var count = 0;
                for(var id in allVals) {

                    var instrumentation = instrumentations[id];

                    var iVals = allVals[id];
                    count = iVals.length
                    for(var dp in iVals){
                        switch(instrumentation['value-arity']) {
                            case 'scalar':
                                instrumentation.buffer.push(iVals[dp]);
                                instrumentation.graphValues.push(iVals[dp]);
                                while(instrumentation.buffer.length > 600) {
                                    instrumentation.buffer.unshift();
                                }
                                while(instrumentation.graphValues.length > 600) {
                                    instrumentation.buffer.unshift();
                                }
                                break;
                            case 'discrete-composition':
                                break;
                            case 'numeric-decomposition':
                                break;
                            default:
                                throw new Error(instrumentation['value-arity'] + ' is incorrect value arity!');

                        }

                        instrumentation.lastEndTime = iVals[dp].end_time;
                    }

                }

                remote = remote + count;
                var diff = local - remote;

                console.log('local: ' + local);
                console.log('remote: ' + remote);
                console.log('diff: ' + diff);

                for(var i in instrumentations) {
                    instrumentations[i].ndatapoints = diff + 1;
                }
                noRequest = true;
            });
        }

        var sync = function(){
            if(Object.keys(instrumentations).length) {
                if(noRequest) {
                    poll();
                }
            } else {
                remote++;
            }
            local++
            $timeout(sync, 1000);
        }
        sync();

        instrumentation.prototype.create = function(unit, cb) {
            var self = this;
            self.$save(function(){
                var id = self.id;
                self.start = Date.now() / 1000;
                self.unit = unit;
                self.buffer = [];
                self.graphValues = [];
                self.lastEndTime = Math.floor(self.crtime/ 1000);
                instrumentations[id] = self;

                if(typeof cb === 'function') {
                    cb();
                }
            });
        }

        var conf = $resource('/cloudAnalytics/ca');

        var graph = function(id){
            this.instrumentation = instrumentations[id];
            this.values = [];
            this.series = [{
                name: 'test',
                color: 'steelblue',
                data: []
            }];
            this.storage = [];
            this.seriesLabels = [];
            this.heatmap = false;

            for(var i =0; i < 200; i++) {
                this.storage.push({
                    "value": Math.floor(Math.random() * 1000),
                    "transformations": {},
                    "start_time": 1364803553 + i,
                    "duration": 1,
                    "end_time": 1364803554 + i,
                    "nsources": 5,
                    "minreporting": 5,
                    "requested_start_time": 1364803553 + i,
                    "requested_duration": 1,
                    "requested_end_time": 1364803554 + i
                })
            }


            this.update();
        };

        graph.prototype.update = function() {
            if(this.instrumentation.buffer.length) {

                this.series[0].data.push({
                    x:this.storage[0].start_time,
                    y:this.storage[0].value
                });
                if(this.series[0].data.length > 20) {
                    this.series[0].data.shift();
                }
                var time = this.series[0].data[this.series[0].data.length -1].x;
                while(this.series[0].data.length < 21) {
                    this.series[0].data.unshift({
                        x:--time,
                        y:0
                    });
                }
                this.values.push(this.storage.shift());
            }

            $timeout(this.update.bind(this), 1000);
        }

        function labelMetrics(metric) {
            var fieldsArr = metric.fields;
            var labeledFields = [];
            for(var f in fieldsArr) {
                labeledFields[fieldsArr[f]] = conf.fields[fieldsArr[f]].label;
            }
            metric.fields = labeledFields;
            var moduleName = conf.modules[metric.module].label;
            metric.labelHtml = moduleName + ': ' + metric.label;
            return metric;
        }

        function service(id) {
            this.conf = new conf();
            this.instrumentations = [];
            if(id) {
                this.instrumentations.push(id);
            }

        };
        service.prototype.describeCa = function(cb) {
            return this.conf;
//            this.conf.$get(function(){
//                console.log('this.conf');
//                console.log(this.conf);
//                console.log(conf);
//                this.conf.metrics.forEach(labelMetrics);
//
//                cb(this.conf);
//            });
        };
        service.prototype.createInstrumentation  = function(options, cb) {

            var i = new instrumentation();

            angular.extend(i, options);
            var self = this;
            i.create(options.unit, function(){
//                console.log(i);
                self.instrumentations.push(i.id);

                self.graph = new graph(i.id);
                cb(self);
            })
        }

        return service;
    }]);


}(window.JP.getModule('cloudAnalytics')));
