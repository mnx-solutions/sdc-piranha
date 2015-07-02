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

Tab.prototype.checkForExistingCall = function (opts) {
    var existingCall = this._calls[opts.id];
    if (existingCall) {
        this.log.child({req_id: opts.id, call: opts.name}).error('Call id already in Tab, ignoring', opts);
        // In case of duplicate call, update a response object for the existing call
        existingCall.setNewResponse(opts.res);
    }
    return existingCall !== undefined;
};

Tab.prototype.call = function (opts) {
    var self = this;
    opts.log = self.log.child({req_id: opts.id, call: opts.name});
    opts.tab = self;
    opts.remove = function (c) {
        //self._history.push(c);
        delete self._calls[c.id];
    };

    var call = new Call(opts);

    function updated(name) {
        return function (err, call2) {
            self._changed[call.id] = call;
            self._readable();
        };
    }

    if (!call.willFinish) {
        call.on('updated', updated('updated'));
        call.on('finished', updated('finished'));
        call.on('error', updated('error'));

        self._calls[call.id] = call;
        self.processing = true;
    } else {
        //self._history.push(call);
    }

    return call;
};

Tab.prototype.read = function (req){
    var self = this;

    if (!self.readable) {
        return [];
    }

    var result = [];

    var keys = Object.keys(self._changed);
    keys.forEach(function (key) {
        var call = self._calls[key];
        result.push(call.status());

        if (call.finished) {
            var fn = call.session();
            if(fn) {
                fn(req);
            }
            delete self._calls[key];
            call.removeAllListeners();
            //self._history.push(call);
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