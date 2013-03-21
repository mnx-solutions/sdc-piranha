'use strict';

var Handler = require('./handler');

function Server(opts) {
  if(!(this instanceof Server)) {
    return new Server(opts);
  }

  this._handlers = {};
  if(!opts.log || typeof opts.log !== 'object'){
    throw new TypeError('Opts.log is a required parameter, must be object');
  }
  this.log = opts.log;
}

Server.prototype.onCall = function (name, handler) {
  var self = this;
  if(self._handlers[name]) {
    self.log.warn("can not have multiple listeners for RPC calls, ignoring");
    return;
  }

  if(handler.constructor.name !== 'Handler') {
    handler = new Handler(handler);
  }
  self._handlers[name] = handler;
};

Server.prototype.query = function () {
      return function(req, res) {
          var id = req.query.tab;
          if (!req._session._processing(id) && !req._session._readable(id)) {
              res.send(204);
              return;
          }

          var timeout = null;
          function send() {
              if(timeout) {
                  clearTimeout(timeout);
              }
              res.json(200, {results:req._session.read(id)});
          }
          if(req._session._readable(id)) {
              send();
          } else {
              setTimeout(function () {
                  req._session.getTab(id).removeListener('readable', send);
                  res.send(200, "");
              }, 3000);

              req._session.getTab(id).once('readable', send);
          }
      };
};

Server.prototype.call = function () {
    var self = this;
    return function (req, res) {
        var call = req.body;
        var id = req.query.tab;

        if ("object" !== typeof call || !call.id || !call.name || !id) {
            req.log.warn("Invalid call format", call);
            res.send(400, "Invalid call format");
            return;
        }

        self.log.debug("Incoming RPC call ", call.name, call.id, id);

        if (!self._handlers[call.name]) {
            self.log.warn("Client tried to call unhandled call", call);
            res.send(501, "Unhandled RPC call", call.name);
            return;
        }

        if(!self._handlers[call.name].verify(call.data)) {
            req.warn("Invalid parameters %s provided for call %s",
                     call.data, call.name);
            res.send(400, "Invalid parameters provided");
            return;
        }
        var opts = call;
        opts.cloud = req.cloud;

        var callContext = req._session.call(id, opts);
        self._handlers[call.name].call(callContext);

        res.send(200);
    };
};

module.exports = Server;
