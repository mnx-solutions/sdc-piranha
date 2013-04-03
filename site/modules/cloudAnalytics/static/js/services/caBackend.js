'use strict';


(function (app) {
    app.factory('caBackend', ['$resource', '$timeout', '$http', 'instrumentation', function ($resource, $timeout, $http, instrumentation) {

        var ca = function(){};
        ca.options = {
            last_poll_time: null,
            ndatapoints: 1,
            individual: {}
        }
        ca.request_time = null;
        ca.instrumentations = {};
        ca.conf = $http.get('/cloudAnalytics/ca');

        var pending = false;

        ca._poll = function() {
            $http.post('/cloudAnalytics/ca/getInstrumentations', {options: ca.options}).success(function(datapoints){

                for(var id in datapoints) {
                    ca.instrumentations[id].addValues(datapoints[id]);
                }

                ca.options.last_poll_time += ca.options.ndatapoints;
                var now = new Date();
                var difference = now - ca.request_time;
                ca.request_time = now;
                ca.options.ndatapoints = difference + 1;

                pending = false;
            });
        }

        var sync = function(){
            if (Object.keys(instrumentations).length) {
                if (!pending) {
                    pending = true;
                    ca.request_time = new Date();
                    ca._poll();
                }
            }
            $timeout(sync, 1000);
        }
        sync();

        function service() {
            this.conf = null;//new conf();
//            this.instrumentations = [];
//            if(id) {
//                this.instrumentations.push(id);
//            }

        };
        service.prototype.describeCa = function(cb) {
            var self = this;
            if(self.conf){
                cb(conf);
            } else {
                ca.conf.then(function(conf) {
                    self.conf = conf;
                    cb(conf);
                });
            }

        };
        service.prototype.createInstrumentation  = function(options, cb) {
            instrumentation.create(options, function(err, inst){
                ca.instrumentations[inst.id] = inst;
                ca.options.individual[inst.id] = {}
                cb(inst);
            });
        }

        return service;
    }]);


}(window.JP.getModule('cloudAnalytics')));
