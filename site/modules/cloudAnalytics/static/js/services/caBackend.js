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


        // Poll all the instrumentation values.
        var pending = false;
        ca._poll = function() {
            $http.post('/cloudAnalytics/ca/getInstrumentations', {options: ca.options}).success(function(res){

                ca.options.last_poll_time = res.end_time;
                var datapoints = res.datapoints;
                for(var id in datapoints) {
                    ca.instrumentations[id].addValues(datapoints[id]);
                }

                var date = new Date();
                var now = Math.floor(date.getTime() / 1000);
                var difference = now - ca.request_time;
                ca.request_time = now;
                //if there's no difference in time (difference == 0), ask 1 datapoint;
                ca.options.ndatapoints = difference || difference + 1;

                pending = false;
            });
        }

        ca._sync = function(){
            if (Object.keys(ca.instrumentations).length) {
                if (!pending) {
                    pending = true;
                    var date = new Date();
                    ca.request_time = Math.floor(date.getTime() / 1000);
                    ca._poll();
                }
            }
            $timeout(ca._sync, 1000);
        }
        ca._sync();


        // The part of service which will be exposed and gets instanciated
        function service() {};
        service.prototype.describeCa = function(cb) {
            var self = this;

            ca.conf.then(function(conf) {
                self.conf = conf.data;
                cb(conf.data);
            });

        };
        service.prototype.createInstrumentation  = function(options, cb) {
//            for(var i = 562; i < 573; i++){
//                console.log(i);
//                $http.delete('/cloudAnalytics/ca/instrumentations/'+i).success(function(res){
//                    console.log(res);
//                })
//            }
            instrumentation.create({
                createOpts: options,
                parent:ca
            }, function(err, inst){
                ca.instrumentations[inst.id] = inst;
                ca.options.individual[inst.id] = {
                    crtime: Math.floor(inst.crtime /1000)
                }
                cb(inst);
            });
        }

        service.prototype.getSeriesById = function(id, range) {
            ca.instrumentations[id].getValues(false, {

            });
        }

        servive.prototype.getAllSeries = function(range) {

        }

        return service;
    }]);


}(window.JP.getModule('cloudAnalytics')));
