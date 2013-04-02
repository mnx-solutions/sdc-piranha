'use strict';


(function (ng, app) {

    app.factory('serverTab',
        [ '$http',
            '$$track',
            'EventBubble',
            'serverCall',
            'localization',
            'notification',
            function ($http, $$track, EventBubble, serverCall, localization, notification) {

        var eventer = EventBubble.$new();
        var self = {};
        var _calls = {};
        var _history = [];
        var polling = false;
        var errorPollingLength = 500;

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
                            timeout: 40000,
                            method: 'get',
                            url: 'server/call',
                            params: {tab: self.id}
                        })
                        .success(function (data, code) {
                            eventer.$emit('polled');
                            polling = false;
                            errorPollingLength = 500;
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
                        .error(function() {
                            console.log(arguments);
                            polling = false;
                            eventer.$emit('error');
                        });
                    }
                }
            },
            results: {
                value: function (data){
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

        self.$on('polled', function() {
            errorPollingLength = 500;

            if (notification.isVisible(self)) {
                //eventer.$emit(true, 'forceUpdate');
            }

            /*
            notification.push(self, { timeout: 5000 },
                localization.translate(null,
                    'server',
                    'Reconnected to polling service'
                )
            );
            */
        });

        self.$on('error', function () {
            errorPollingLength = errorPollingLength * 2;
            var time = errorPollingLength / 1000;

            notification.push(self, { type: 'error' },
                localization.translate(null,
                    'server',
                    'Lost contact with server retrying in {{seconds}}',
                    { seconds: time }
                )
            );

            var timer = setInterval(function () {
                time--;

                if (time > 0) {
                    notification.push(self, { type: 'error' },
                        localization.translate(null,
                            'server',
                            'Lost contact with server retrying in {{seconds}}',
                            { seconds: time }
                        )
                    );
                } else {
                    notification.push(self, { type: 'error' },
                        localization.translate(null,
                            'server',
                            'Retrying...'
                        )
                    );

                    clearInterval(timer);
                    self.poll();
                }
            }, 1000);
        });

        return self;
    }]);

}(window.angular, window.JP.getModule('Server')));
