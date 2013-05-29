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
    self.log.warn('can not have multiple listeners for RPC calls, ignoring');
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
              res.json(200, {results:req._session.read(req, id)});
          }
          if(req._session._readable(id)) {
              send();
          } else {
              timeout = setTimeout(function () {
                  req._session.getTab(id).removeListener('readable', send);
                  res.send(200, '');
              }, 30000);

              req._session.getTab(id).once('readable', send);
          }
      };
};

Server.prototype.call = function () {
    var self = this;
    return function (req, res) {
        var query = req.body;
        var id = req.query.tab;

        if ('object' !== typeof query || !query.id || !query.name || !id) {
            req.log.warn('Invalid call format', query);
            res.send(400, 'Invalid call format');
            return;
        }

        self.log.debug('Incoming RPC call', query.name, query.id, id);

        if (!self._handlers[query.name]) {
            self.log.warn('Client tried to call unhandled call', query);
            res.send(501, 'Unhandled RPC call', query.name);
            return;
        }

        if(!self._handlers[query.name].verify(query.data)) {
            req.log.warn({params:query.data}, 'Invalid parameters  provided for call %s', query.name);
            res.send(400, 'Invalid parameters provided');
            return;
        }
        var opts = query;
        opts.cloud = req.cloud;
        opts.handler = self._handlers[query.name];
        opts.res = res;
        opts.req = req;

        var call = req._session.call(id, opts);

        if(!call.immediate) {
            res.send(202);
        }
    };
};

module.exports = Server;
