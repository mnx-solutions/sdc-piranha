'use strict';

var events = require('events');
var util = require('util');
var Call = require('./call');
var sessions = {};

function Session(opts) {
  if(!(this instanceof Session)) {
    return new Session(opts);
  }

  events.EventEmitter.call(this);

  var self = this;

  self.id = opts.id;

  self._calls = {};
  self._changed = [];
  self._lifespan = opts.lifespan;

  self._history = [];

  self.log = opts.log;

  self.readable = false;
  self.processing = false;

  setTimeout(function () {
    if (sessions[self.id]) {
      delete sessions[self.id];
    }
  }, self._lifespan);

  sessions[self.id] = self;
}

util.inherits(Session, events.EventEmitter);

Session.prototype.call = function (opts) {
  var self = this;
  var logger = self.log.child({req_id: opts.id, call: opts.name});
  if (self._calls[opts.id]) {
    logger.error('Call id already in session, ignoring', opts);
    return false;
  }
  opts.log = logger;
  var call = new Call(opts);

  call.on('change', function() {
    self._changed[call.id] = call;
    self._readable();
  });

  self._calls[call.id] = call;
  self.processing = true;

  return call;
}

Session.prototype.read = function (){
  var self = this;

  if (!self.readable) {
    return [];
  }

  var result = [];

  var keys = Object.keys(self._changed);
  keys.forEach(function (key) {
    var call = self._calls[key];
    result.push(call.getStatus());
    if(call.finished) {
      delete self._calls[key];
      self._history.push(call);
    }
  });

  self._changed = {};
  self.processing = Object.keys(self._calls).length > 0;
  self.readable = false;

  return result;
}

Session.prototype._readable = function () {
  var self = this;

  if (self.readable) {
    return;
  }
  self.readable = true;
  self.emit('readable');
}

Session.get = function (req, res, next) {
  if (!req.session || !req.session.id) {
    var err = new Error('Session is missing');
    err.code = 500;
    req.scope.log(err);
    next(err);
    return;
  }
  if(sessions[req.session.id]) {
    req._session = sessions[req.session.id];
  } else {
    req._session = new Session({
      id: req.session.id,
      log: req.scope.log,
      lifespan: (req.scope.config.session && req.scope.config.session.lifespan) || 24 * 60 * 60
    });
  }
  next();
}

module.exports = Session;