'use strict';


(function (app) {

    app.factory('caBackend', ['$resource', '$timeout', function ($resource, $timeout) {

        var instrumentation = $resource('/cloudAnalytics/ca/instrumentations/:id', {id:'@id'}, {
            clone: {method:'POST', params:{clone: '@id'}}
        });
        var value = $resource('/cloudAnalytics/ca/instrumentations/value/:id', {id:'@id'},{
            raw: {method: 'GET', params:{subject:'raw'}},
            heatmap: {method: 'GET', params:{subject:'heatmap'}}
        })

        instrumentation.prototype.poll = function(method){
            var self = this;
            if(!self.buffer){
                self.buffer = [];
                self.values = [];
            }

            var values = value[method]({id:self.id}, function(){

                self.buffer.push(values);

                $timeout(self.poll.bind(self, method), 1000);
            });


        }
        instrumentation.prototype.create = function(getValue, cb) {
            var self = this;
            self.$save(function(){
                if(getValue) {
                    switch(getValue){
                        case 'raw':
                            self.raw(cb);
                            break;
                        case 'decomposed':
                            self.raw(cb);
                            break;
                        case 'heatmap':
                            self.heatmap(cb);
                            break;
                    }
                } else {
                    if(typeof cb === 'function') {
                        cb();
                    }
                }
            })

        }
        var conf = $resource('/cloudAnalytics/ca');
        instrumentation.prototype.raw = function(cb) {
            this.poll('raw');
            if(typeof cb === 'function')
                cb();
        }

        instrumentation.prototype.heatmap = function(cb) {
            this.poll('heatmap');
            if(typeof cb === 'function')
                cb();
        }

        var caBackend = {
            conf: conf,
            instr: instrumentation
        };

        return caBackend;
    }]);

}(window.JP.getModule('cloudAnalytics')));
