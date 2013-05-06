'use strict';

var events = require('events');
var util = require('util');

function deepCompare(a, b) {
    var tA = typeof a;
    var tB = typeof b;
    if (tA !== tB) {
        return false;
    }
    if(a === null && b === null) {
        return true;
    }
    if(a === null || b === null) {
        return false;
    }
    if (tA === 'object') {
        var aKeys = Object.keys(a);
        var bKeys = Object.keys(b);

        if(aKeys.length !== bKeys.length) {
            return false;
        }
        var ret = true;
        aKeys.forEach(function (k) {
            if(!deepCompare(a[k], b[k])){
                ret = false;
            }
        });
        return ret;
    }

    return a === b;
}

function Call(opts) {
    if(!(this instanceof Call)) {
        return new Call(opts);
    }

    events.EventEmitter.call(this);

    var self = this;

    self.log = opts.log;

    var _index = 0;
    var _status = 'created';
    var _result = [];
    var _error = [];
    var _step = [];
    var _chunked = false;
    var _noEmit = false;
    var _bind = false;
    var _session = [];

    function wrapEnum(obj) {
        Object.keys(obj).forEach(function (k) {
            obj[k].enumerable = true;
        });
        return obj;
    }

    var final = false;

    function emit(event, data) {
        if(!final && !_noEmit) {
            self.emit(event, self.err, data);
        }
        if(self.finished) {
            final = true;
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
            value: opts.cloud
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
                if(fn) {
                    _session.push(fn);
                    return;
                }
                if(_session.length < 1) {
                    return false;
                }
                return function (req) {
                    _session.forEach(function (fn) {
                        fn(req);
                    });
                };
            }
        },
        step: {
            get: function () { return _step.length < 1 ? null : _step[_step.length -1]; },
            set: function (s) {
                var old = self.step;
                _step.push(s);
                if(!deepCompare(old, s)) {
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
                    if(data) {
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
                var r = _result.slice(i);
                if (index === undefined) {
                    _index += r.length;
                }
                return r;
            }
        },
        error: {
            value: function(err) {
                if (err) {
                    self.err = err;
                    self.status('error');
                }
            }
        },
        update: {
            value: function(err, result, done) { // Hack to ensure that events are binded
                function update() {
                    if(err) {
                        return self.error(err);
                    }
                    self.result(result, done);
                }

                if(!_bind) {
                    setImmediate(update);
                } else {
                    update();
                }
            }
        },
        done: {
            value: function (err, result) {
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
                        self.error(err);
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
                    return;
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

    self.start();
}

util.inherits(Call, events.EventEmitter);


module.exports = Call;