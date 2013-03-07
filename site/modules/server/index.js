'use strict';


var express = require('express');
var assert = require('assert');
var app = express();

var EventEmitter = require('events').EventEmitter

var clientEvents = new EventEmitter();
var logger = JP.getLog();

var callHandlers = {};


JP.registerModuleAPI("Server", {
    onCall: function (callName, handler) {
        logger.debug("RPC Call listener registered for", callName);

        if ("object" == typeof handler) {
            assert("function" == typeof handler.handler,
                "handler object must contain handler function");

            assert(handler.verify && ("function" == typeof handler.verify),
                "verify must be a function");
        }

        if (callHandlers[callName]) {
            logger.warning("can not have multiple listeners for RPC calls, ignoring");
            return;
        }

        callHandlers[callName] = handler;
    }
});

function returnResults(req, res) {
    if (!req.session.callResults) {
        req.session.callResults = [];
    }

    req.session.callResults.forEach(function (result) {
        logger.debug("Sending result of command to client", result);
    });

    res.json(req.session.callResults);
    req.session.callResults = [];
    req.session.save();
}

// return results of all finished calls
app.get('/call', returnResults);

// handle incoming serverside calls
// may return results of finished calls
app.post('/call', function (req, res) {
    var call = req.body;

    if (!req.session.callResults) {
        req.session.callResults = [];
    }

    if ("object" != typeof call || !call.id || !call.name){
        logger.warn("Invalid call format", call);
        res.send(400, "Invalid call format");
        return;
    }

    logger.debug("Incoming RPC call ", call.name, call.id);

    var callHandler = callHandlers[call.name];
    if (callHandler) {
        var handler;
        if ("object" == typeof callHandler) {
            if (!callHandler.verify(call.data)) {
                logger.warn("Invalid parameters %s provided for call %s",
                    call.data, call.name);

                res.send(400, "Invalid parameters provided");
                return;
            }

            handler = callHandler.handler;
        } else {
            handler = callHandler;
        }

        var callContext = {
            cloud: req.cloud,
            id: call.id,
            log: JP.getLog({req_id:call.id, call:call.name})
        };

        // call handler if everything is ok
        callHandler(callContext, call.data, function (err, result) {
            logger.debug("Call handled, storing result", call.name, call.id)

            req.session.callResults.push({
                name: call.name,
                id: call.id,
                error: err,
                result: result
            });

            req.session.save();
        });


        returnResults(req, res);
    } else {
        res.send(501, "Unhandled RPC call", call.name);
        logger.warn("Client tried to call unhandled call", call);
    }
});

module.exports = {
    app: app,
    authenticate: true,
    csss: ['css/menu.css'],
    javascripts: [
        'js/module.js',
        'js/services/rpc.js'
    ]
};
