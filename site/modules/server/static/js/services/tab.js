'use strict';


(function (ng, app) {

    app.factory('serverTab', ['$http','$$track','EventBubble', 'serverCall', function ($http, $$track, EventBubble, serverCall) {

        var eventer = EventBubble.$new();
        var self = {};
        var _calls = {};
        var _history = [];
        var polling = false;

        Object.defineProperties(self, {
            id: {
                value: window.uuid.v4()
            },
            call: {
                value: function (opts) {
                    if (!opts) {
                        return _calls;
                    }
                    if (typeof opts === 'string'){
                        return _calls[opts];
                    }
                    opts.tab = self;
                    var call = serverCall.new(opts);
                    console.log(call);
                    _calls[call.id] = call;

                    return call;
                }
            },
            history: {
                value: function (call) {
                    if (!call) {
                        return _history;
                    }
                    if (typeof call === 'string') {
                        call = self.call(call);
                        if(!call) {
                            return;
                        }
                    }
                    $$track.timing('Task', call.name, call.execTime);
                    _history.push(call);
                    delete _calls[call.id];
                }
            },
            poll: {
                value: function (){
                    if (!polling && Object.keys(_calls).length > 0) {
                        polling = true;
                        // get call results
                        $http({
                            timeout: 30000,
                            method: 'get',
                            url: 'server/call',
                            params: {tab: self.id}
                        })
                        .success(function (data, code) {
                            polling = false;
                            if (code === 200) {
                                self.results(data);
                                setTimeout(self.poll, 100);
                            } else if (code === 204) {
                                console.log('nothing processing');
                                if (Object.keys(_calls).length) {
                                    console.log('ERROR: Out of sync');
                                    console.log(_calls);
                                }
                            }
                        })
                        .error(function () {
                            polling = false;
                            // TODO handle errors.
                            setTimeout(self.poll, 1000);
                        });
                    }
                }
            },
            results: {
                value: function (data){
                    console.log(data);
                    if (!data || !data.results) {
                        return;
                    }

                    data.results.forEach(function (result) {
                        var call = self.call(result.id);
                        if (!call) {
                            return;
                        }
                        call.handleRaw(result);
                    });
                }
            },
            $on: {
                value: function (event, cb) {
                    return eventer.$on(event, cb);
                }
            }
        });


        return self;
    }]);

}(window.angular, window.JP.getModule('Server')));
