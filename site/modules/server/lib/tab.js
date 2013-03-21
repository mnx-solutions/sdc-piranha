'use strict';

var events = require('events');
var util = require('util');
var Call = require('./call');
var Tabs = {};

function Tab(opts) {
    if(!(this instanceof Tab)) {
        return new Tab(opts);
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

    if (self._lifespan) {
        setTimeout(function () {
            if (Tabs[self.id]) {
                delete Tabs[self.id];
            }
        }, self._lifespan);
    }

    Tabs[self.id] = self;
}

util.inherits(Tab, events.EventEmitter);

Tab.prototype.call = function (opts) {
    var self = this;
    var logger = self.log.child({req_id: opts.id, call: opts.name});
    if (self._calls[opts.id]) {
        logger.error('Call id already in Tab, ignoring', opts);
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
};

Tab.prototype.read = function (){
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
};

Tab.prototype._readable = function () {
    var self = this;

    if (self.readable) {
        return;
    }
    self.readable = true;
    self.emit('readable');
};

module.exports = Tab;