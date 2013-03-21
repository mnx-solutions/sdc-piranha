'use strict';

var events = require('events');
var util = require('util');
var Tab = require('./tab');
var sessions = {};

function Session(opts) {
    if(!(this instanceof Session)) {
        return new Session(opts);
    }

    events.EventEmitter.call(this);

    var self = this;

    self.id = opts.id;

    self._tabs = {};

    self._lifespan = opts.lifespan;

    self.log = opts.log;

    setTimeout(function () {
        if (sessions[self.id]) {
            delete sessions[self.id];
        }
    }, self._lifespan);

    sessions[self.id] = self;
}

util.inherits(Session, events.EventEmitter);

Session.prototype.call = function (id, opts) {
    return this.getTab(id).call(opts);
};

Session.prototype.read = function (id){
    return this.getTab(id).read();
};

Session.prototype._processing = function (id) {
    return this.getTab(id).processing;
};

Session.prototype._readable = function (id) {
    return this.getTab(id).readable;
};

Session.prototype.getTab = function (id) {
    if (!id) {
        throw new TypeError('Tab id missing');
    }
    if (!this._tabs[id]) {
        this._tabs[id] = new Tab({id:id, log: this.log});
    }
    return this._tabs[id];
};

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
            lifespan: (req.scope.config.session && req.scope.config.session.lifespan) || 24 * 60 * 60 * 1000
        });
    }
    next();
}

module.exports = Session;