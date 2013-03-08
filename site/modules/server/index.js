'use strict';


var express = require('express');
var assert = require('assert');
var app = express();

var EventEmitter = require('events').EventEmitter

var clientEvents = new EventEmitter();
var logger = JP.getLog();

var callHandlers = {};

// XXX must replace with something persistent and handle timeouts
var eventStorage = {};

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

function getResultStorageForSession(session){
    if (!eventStorage[session.id]) {
        eventStorage[session.id] = {}
    }
    var result = eventStorage[session.id];

    if (!result.callResults) {
        result.callResults = [];
    }

    if (!result.callProgress) {
        result.callProgress = [];
    }

    return result;
}

function returnResults(req, res) {

    var result = getResultStorageForSession(req.session);

    result.callResults.forEach(function (result) {
        logger.debug("Sending result of command to client", result);
    });

    result.callProgress.forEach(function (result) {
        logger.debug("Sending progress of command to client", result);
    });

    res.json(200, {
        results: result.callResults,
        progress: result.callProgress
    });

    if (result.callResults.length > 0) {
        result.callResults = [];
    }

    if (result.callProgress.length > 0) {
        result.callProgress = [];
    }
}

var resultEmitter = new EventEmitter();

// return results of all finished calls
app.get('/call', function (req, res) {

    var result = getResultStorageForSession(req.session);

    if ((result.callResults && result.callResults.length > 0)
        || (result.callProgress && result.callProgress.length > 0)) {
        returnResults(req, res);
    } else {

        var listener = function () {
            returnResults(req, res);
        }

        var timeout = setTimeout(function () {
            resultEmitter.removeListener("result-" + req.session.id, listener);
            res.send(200, "");
        }, 3000);

        resultEmitter.once("result-" + req.session.id, listener);
    }
});

// handle incoming serverside calls
// may return results of finished calls
app.post('/call', function (req, res) {
    var call = req.body;

    if (!eventStorage[req.session.id]) {
        eventStorage[req.session.id] = {}
    }

    var resultList = eventStorage[req.session.id];

    if (!resultList.callResults) {
        resultList.callResults = [];
    }

    if (!resultList.callProgress) {
        resultList.callProgress = [];
    }

    if ("object" != typeof call || !call.id || !call.name) {
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
            log: JP.getLog({req_id: call.id, call: call.name}),
            data: call.data,
            done: function (err, result) {
                logger.debug("Call handled, storing result", call.name, call.id)

                resultList.callResults.push({
                    name: call.name,
                    id: call.id,
                    error: err,
                    result: result
                });

                //req.session.save();

                resultEmitter.emit("result-" + req.session.id);
            },
            progress: function (result) {
                logger.debug("Progress update handled, storing result", call.name, call.id);

                resultList.callProgress.push({
                    id: call.id,
                    result: result
                });

                //req.session.save();

                resultEmitter.emit("result-" + req.session.id);
            }
        };

        // call handler if everything is ok
        handler(callContext);

        // send pending results with POST also
        //returnResults(req, res);
        //res.end();
        res.send(200);
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
