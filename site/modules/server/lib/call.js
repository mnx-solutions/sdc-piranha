'use strict';

var events = require('events');
var util = require('util');

function Call(opts) {
    if(!(this instanceof Call)) {
        return new Call(opts);
    }

    events.EventEmitter.call(this);

    var self = this;

    self.log = opts.log;

    self._result = null;
    self._error = null;
    self._timeout = null;
    self._noemit = false;
    self.finished = false;

    var startTime = new Date().getTime();
    var endTime = null;

    var _status = [];
    var _result = [];
    var _index = 0;

    Object.defineProperties(self, {
        id: {
            value: opts.id,
            enumerable: true
        },
        name: {
            value: opts.name,
            enumerable: true
        },
        data: {
            value: opts.data,
            enumerable: true
        },
        cloud: {
            value: opts.cloud,
            enumerable: true
        },
        status: {
            get: function() {
                if (_status.length < 1) {
                    return null;
                }
                return _status[_status.length - 1];
            },
            set: function(s) {
                if (!self.finished) {
                    self.log.debug("Progress update handled, storing result", self.name, self.id);
                    _status.push(s);
                    if (!self._noemit) {
                        self.emit('change');
                    }
                } else {
                    self.log.warn("Progress update called after process finished", s, self.name, self.id);
                }
            },
            enumerable:true
        },
        result: {
            get: function() {
                if (_result.length < 1) {
                    return null;
                }
                return _result[_result.length -1];
            },
            set: function(s) {
                if (!self.finished) {
                    self.log.debug("Progress update handled, storing result", self.name, self.id);
                    if (self._noemit && _result.length < 1) {
                        _result = s;
                    } else {
                        _result.push(s);
                    }
                    if (!self._noemit) {
                        self.emit('change');
                    }
                } else {
                    self.log.warn("Progress result called after process finished", s, self.name, self.id);
                }
            },
            enumerable:true
        },
        __read: {
            value: function (id) {

                if (!util.isArray(_result)) {
                    return _result;
                }

                if (_result.length < 1) {
                    return [];
                }

                if (id === '_full_') {
                    return _result.slice(0);
                }

                var r = _result.slice(_index);
                _index += r.length;
                return r;
            }
        },
        startTime: {
            value: startTime,
            enumerable: true
        },
        endTime: {
            get: function() {
                return endTime;
            }
        },
        execTime: {
            get: function() {
                if(!endTime) {
                    return false;
                }
                return endTime - startTime;
            },
            enumerable: true
        }
    });

    Object.defineProperties(self, {
        done: {
            value: function(err, result) {

                if (self.finished && endTime) {
                    self.log.warn('Process done called more than once');
                    return false;
                }
                endTime = new Date().getTime();
                self._noemit = true;

                self._error = err;
                self.log.debug({
                    execTime: self.execTime,
                    err: self._error
                }, "Call %s handled in %sms, storing result", self.name, self.execTime);

                self.status = 'finished';

                self.result = result;
                self._noemit = false;
                self.finished = true;
                self.emit('change');

                if(self._timeout) {
                    clearTimeout(self._timeout);
                }
            }
        }
    });
}

util.inherits(Call, events.EventEmitter);

Call.prototype.timeout = function (time) {
    var self = this;

    if(!self._timeout) {
        self._timeout = setTimeout(function() {
            self.done(new Error('Call timed out'));
        }, time);
    }
};

Call.prototype.getStatus = function () {
    var self = this;
    return {
        id: self.id,
        name: self.name,
        finished: self.finished,
        error: self._error,
        status: self.status,
        result: self.__read()
    };
};

module.exports = Call;