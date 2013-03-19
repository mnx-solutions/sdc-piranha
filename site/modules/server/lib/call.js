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

  var startTime = new Date().getTime();
  var endTime = null;


  var _progress = [];

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
    progress: {
      get: function() {
        if (_progress.length < 1) {
          return null;
        }
        return _progress[_progress.length -1];
      },
      set: function(s) {
        self.log.debug("Progress update handled, storing result", self.name, self.id);
        _progress.push(s);
        self.emit('change');
      },
      enumerable:true
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
        if (endTime) {
          self.log.warn('Process done called more than once');
          return false;
        }
        endTime = new Date().getTime();

        self._error = err;
        self.log.debug({execTime: self.execTime, err: self._error}, "Call %s handled in %sms, storing result", self.name, self.execTime);
        self.progress = result;

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
}

Call.prototype.getStatus = function () {
  var self = this;
  return {
    id: self.id,
    name: self.name,
    finished: !!self.endTime,
    error: self._error,
    status: self.progress
  };
}

module.exports = Call;