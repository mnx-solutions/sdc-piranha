'use strict';

function Handler(opts) {
    if (!(this instanceof Handler)) {
        return new Handler(opts);
    }

    this._verify = null;
    this._handler = null;
    this._timeout = null;

    if (typeof opts === 'function') {
        this._handler = opts;
    } else {
        this._verify = opts.verify;
        this._handler = opts.handler;
        this._timeout = opts.timeout;
    }
}

Handler.prototype.verify = function (data) {
    if (!this._verify) {
        return true;
    }

    return this._verify(data);
};

Handler.prototype.call = function (context) {
    var self = this;

    if(self._timeout) {
        context.timeout(self._timeout);
    }

    this._handler(context);
};

module.exports = Handler;