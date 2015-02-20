'use strict';

var events = require('events');
var util = require('util');

function deepCompare(a, b) {
    var tA = typeof a;
    var tB = typeof b;

    if (tA !== tB) {
        return false;
    }

    if (a === null && b === null) {
        return true;
    }

    if (a === null || b === null) {
        return false;
    }

    if (tA === 'object') {
        var aKeys = Object.keys(a);
        var bKeys = Object.keys(b);

        if (aKeys.length !== bKeys.length) {
            return false;
        }

        var ret = true;
        aKeys.forEach(function (k) {
            if (!deepCompare(a[k], b[k])){
                ret = false;
            }
        });

        return ret;
    }

    return a === b;
}

function Call(opts) {
    if (!(this instanceof Call)) {
        return new Call(opts);
    }

    events.EventEmitter.call(this);

    var self = this;
    self.__id = Math.random().toString(36).substr(2);
    self.log = opts.log.child({call__id: self.__id});

    var _index = 0;
    var _status = 'created';
    var _result = [];
    var _error = [];
    var _step = [];
    var _chunked = false;
    var _noEmit = false;
    var _bind = false;
    var _session = [];
    var _done = false;
    var _stack = null;

    function wrapEnum(obj) {
        Object.keys(obj).forEach(function (k) {
            obj[k].enumerable = true;
        });
        return obj;
    }

    var isFinal = false;

    function emit(event, data) {
        if (!isFinal && !_noEmit) {
            self.emit(event, self.err, data);
        }

        if (self.finished) {
            isFinal = true;
        }
    }

    Object.defineProperties(self, wrapEnum({
        id: {
            value: opts.id
        },
        name: {
            value: opts.name
        },
        data: {
            value: opts.data
        },
        cloud: {
            value: opts.cloud.separate()
        },
        tab: {
            value: opts.tab
        },
        req: {
            value: opts.req
        },
        res: {
            value: opts.res
        },
        session: {
            value: function (fn) {
                if (fn) {
                    _session.push(fn);
                    return null;
                }

                if (_session.length < 1) {
                    return false;
                }

                return function (req) {
                    _session.forEach(function (sessionFunc) {
                        sessionFunc(req);
                    });
                };
            }
        },
        step: {
            get: function () {
                return _step.length < 1 ? null : _step[_step.length -1];
            },
            set: function (s) {
                var old = self.step;
                _step.push(s);

                if (!deepCompare(old, s)) {
                    self.status('updated');
                }
            }
        },
        err: {
            get: function () { return _error.length < 1 ? null : _error[_error.length -1]; },
            set: function (s) { _error.push(s); }
        },
        result: {
            value: function (data, done) {
                if (done && _result.length < 1) {
                    _result = data;
                } else {
                    if (data) {
                        _result.push(data);
                    }

                    _chunked = true;
                }
                self.status(done ? 'finished' : 'updated');
            }
        },
        chunked: {
            get: function () { return _chunked; }
        },
        finished: {
            get: function () { return _status === 'finished' || _status === 'error'; }
        },
        __read: {
            value: function (index) {
                if (!_chunked) {
                    return _result;
                }

                var i = index === undefined ? _index : index;
                var r = Array.isArray(_result) ? _result.slice(i) : _result;

                if (index === undefined) {
                    _index += r.length;
                }

                return r;
            }
        },
        error: {
            value: function(err, noLog) {
                if (err) {
                    self.err = err;
	                if(!noLog) {
                        if (err.name === 'NotAuthorizedError') {
                            self.log.info(err);
                        } else {
                            self.log.error(err);
                        }
	                }
                    self.status('error');
                }
            }
        },
        update: {
            value: function(err, result, done) { // Hack to ensure that events are binded
                function update() {
                    if (err) {
                        return self.error(err, result);
                    }
                    return self.result(result, done);
                }

                if (!_bind) {
                    setImmediate(update);
                } else {
                    update();
                }
            }
        },
        done: {
            value: function (err, result) {
                if (_done) {
                    var stack = new Error().stack;
                    self.log.error('Tried to call done on already done call', err, result, stack);
                    self.log.error('Previous stack trace', _stack);
                    return;
                }

                _done = true;
                _stack = new Error().stack;
                self.update(err, result, true);
            }
        },
        start: {
            value: function () {
                _status = 'started';
                opts.handler.call(self);
                delete self.getImmediate;
                _bind = true;
            }
        },
        getImmediate: {
            value: function (done) {
                if (done) {
                    self.willFinish = true;
                }

                self.immediate = function (err, data) {
                    _noEmit = true;
                    _status = 'initialized';

                    if (err) {
                        self.removeAllListeners();
                        opts.remove(self);
                        self.error(err, data);
                    }

                    if (done) {
                        self.result(data, done);
                        opts.res.send(self.status());
                    } else {
                        opts.res.send({
                            id: self.id,
                            name: self.name,
                            status: _status,
                            finished: self.finished,
                            error: self.err,
                            step: self.step,
                            data: data
                        });
                    }

                    _noEmit = false;
                    self.immediate = null;
                };

                return self.immediate;
            },
            configurable: true,
            writeable: true
        },
        status: {
            value: function(status) {
                if (status) {
                    _status = status;
                    emit(status, self);
                    return null;
                }
                return {
                    id: self.id,
                    name: self.name,
                    finished: self.finished,
                    chunked: self.chunked,
                    error: self.err,
                    step: self.step,
                    status: _status,
                    result: self.__read()
                };
            }
        }
    }));

    return self.start();
}

util.inherits(Call, events.EventEmitter);

module.exports = Call;