'use strict';

(function (ng, app) {
    app.factory('serverCall', [
        '$http',
        '$rootScope',
        'EventBubble',
        '$q',
        function ($http, $rootScope, EventBubble, $q) {
            function Call(opts) {
                if (!(this instanceof Call)) {
                    return new Call(opts);
                }

                var eventer = EventBubble.$new();
                var self = {};

                var _index = 0;
                var _status = 'created';
                var _result = [];
                var _error = [];
                var _step = [];
                var _chunked = false;
                var _startTime = new Date().getTime();
                var _endTime = null;
                var deferred = $q.defer();

                function wrapEnum(obj) {
                    Object.keys(obj).forEach(function (k) {
                        obj[k].enumerable = true;
                    });
                    return obj;
                }

                var _final = false;

                function emit(event, data) {
                    if (self.finished) {
                        _endTime = new Date().getTime();
                        self.tab.history(self); // Remove from active calls

                        if (_status === 'error' || self.err) {
                            if (self.err.statusCode && self.err.statusCode === 401) {
                                $rootScope.$broadcast('event:auth-loginRequired', self.err, data);
                            }

                            deferred.reject(self.err);
                        } else {
                            deferred.resolve(self.__read(0));
                        }
                    }

                    if (!_final) {
                        eventer.$emit(event, self.err, data); // always add err object as first
                    }

                    if (self.finished) {
                        _final = true;
                    }
                }

                Object.defineProperties(self, wrapEnum({
                    id: {
                        value: window.uuid.v4()
                    },
                    name: {
                        value: opts.name
                    },
                    data: {
                        value: opts.data
                    },
                    tab: {
                        value: opts.tab
                    },
                    deferred: {
                        value: deferred.promise
                    },
                    step: {
                        get: function () {
                            return _step.length < 1 ? null : _step[_step.length -1];
                        },
                        set: function (s) {
                            _step.push(s);
                        }
                    },
                    err: {
                        get: function () {
                            return _error.length < 1 ? null : _error[_error.length -1];
                        },
                        set: function (s) {
                            _error.push(s);
                        }
                    },
                    result: {
                        value: function (data, status) {
                            if (data) {
                                _result = _chunked ? _result.concat(data) : data;
                                // Handle last chunk
                                if (_chunked && status === 'finished') {
                                    emit('updated', self);
                                }
                            }
                        }
                    },
                    chunked: {
                        get: function () {
                            return _chunked;
                        }
                    },
                    finished: {
                        get: function () {
                            return _status === 'finished' || _status === 'error';
                        }
                    },
                    error: {
                        value: function (err) {
                            if (err) {
                                self.err = err;
                                self.status('error');
                                if (err.status === 0) {
                                    if (err.name !== 'GetUserConfig' && err.name !== 'SetUserConfig') {
                                        var message = err.name ? 'Unable to retrieve ' + err.name : '';
                                        $rootScope.$emit('crashRequest', message);
                                    }
                                }

                            }
                        }
                    },
                    handleRaw: {
                        value: function (data) {
                            self.step = data.step;
                            _chunked = data.chunked;
                            self.result(data.result, data.status);
                            _status = data.status;
                            self.error(data.error);
                            self.status();
                        }
                    },
                    initialize: {
                        value: function (data) {
                            self.step = data.step;
                            _status = data.status;
                            self.error(data.error);

                            if (data.result) {
                                self.result(data.result);
                            }

                            if (data.data) {
                                self.initial = data.data;
                            }

                            self.status();
                            if (!self.finished) {
                                self.tab.poll();
                            }
                        }
                    },
                    start: {
                        value: function () {
                            _status = 'started';

                            $http({
                                method:'POST',
                                url:'server/call',
                                data: {
                                    id: self.id,
                                    name: self.name,
                                    data: self.data
                                },
                                params: {
                                    tab: self.tab.id
                                }
                            }).then(function (data, code) {
                                if (code === 202) {
                                    self.tab.poll();
                                } else {
                                    self.initialize(data);
                                }
                            }, function (o) {
                                var err = o || new Error('Internal server error');
                                err.name = self.name;
                                self.error(err);
                            });
                        }
                    },
                    status: {
                        value:function(status) {
                            if (status) {
                                _status = status;
                            }
                            emit(_status, self);
                            return;
                        }
                    },
                    progress: {
                        value: function (cb) {
                            eventer.$on('updated', cb);
                        }
                    },
                    initialized: {
                        value: function (cb) {
                            eventer.$on('initialized', cb);
                        }
                    },
                    done: {
                        value: function (cb, errCb) {
                            if (!errCb) {
                                errCb = cb;
                            }

                            eventer.$on('finished', cb);
                            eventer.$on('error', errCb);
                        }
                    },
                    $on: {
                        value: function (event, cb){
                            return eventer.$on(event, cb);
                        }
                    },
                    execTime: {
                        get: function () {
                            return !_endTime ? null : _endTime - _startTime;
                        }
                    },
                    __read: {
                        value: function (index) {
                            if (!_chunked) {
                                return _result;
                            }

                            var i = index === undefined ? _index : index;
                            var r = _result.slice(i);

                            if (index !== undefined) {
                                _index += r.length;
                            }

                            return r;
                        }
                    },
                    getTracker: {
                        value: function() {
                            var jobTracker = {};
                            var obj = {};

                            [ 'id', 'name', 'data', 'finished', 'deferred' ].forEach(function (k) {
                                obj[k] = {
                                    get: function() {
                                        return self[k];
                                    }
                                };
                            });

                            obj.getJob = {value: function () { return self; }};

                            Object.defineProperties(jobTracker, wrapEnum(obj));
                            return jobTracker;
                        }
                    }
                }));

                if (opts.progress) {
                    self.progress(opts.progress);
                }

                if (opts.done) {
                    self.done(opts.done, opts.error);
                }

                if (opts.initialized) {
                    self.initialized(opts.initialized);
                }

                self.start();
                return self;
            }

            return {
                create: function(opts) {
                    return new Call(opts);
                }
            };
        }]);
}(window.angular, window.JP.getModule('Server')));