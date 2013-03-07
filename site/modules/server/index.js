'use strict';


var express = require('express');
var assert = require('assert');
var app = express();

var EventEmitter = require('events').EventEmitter

var clientEvents = new EventEmitter();
var logger = JP.getLog();


var callHandlers = {};

JP.registerModuleAPI("Server", {
    registerEvent: function (eventname, listener) {
        logger.debug("listener created for", eventname);
        clientEvents.on(eventname, listener);
    },
    sendEvent: function (session, event, data) {
        if (!session.clientEvents) {
            session.clientEvents = [];
        }
        ;

        session.clientEvents.push({event: event, data: data});
    },
    registerCallHandler: function (call, listener) {
        logger.debug("long call listener registered for", call.name);
        if (callHandlers[call]) {
            logger.warning("can not have multiple listeners for calls, ingoring");
            return;
        }

        callHandlers[call] = listener;
    }
});

app.get('/', function (req, res) {
    res.json(req.session.clientEvents);
    req.session.clientEvents = [];
});

app.post('/', function (req, res) {
    req.body.forEach(function (event) {
        logger.debug("Emitting clientside event", event)

        clientEvents.emit(event.event, req, event.data);
        logger.debug(clientEvents.listeners(event.name))
    });
});


function returnResults(req, res) {
    if (!req.session.callResults) {
        req.session.callResults = [];
    }

    req.session.callResults.forEach(function (result){
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

    logger.debug("Incoming RPC call ", call.name)

    var callHandler = callHandlers[call.name];
    if (callHandler) {

        // call handler if everything is ok
        callHandler(req.cloud, call.data, function (err, result) {
            logger.debug("Call handled", call.name, call.id)

            req.session.callResults.push({
                name: call.name,
                id: call.id,
                error: err,
                result: result
            });

            req.session.save();
        });

        // wait a little bit. maybe the result of
        // short running call will be there
        setTimeout(returnResults(req, res), 100);
    } else {
        res.send(405, "Unhandled RPC call", call.name);
        logger.warn("Client tried to call unhandled call", call);
    }
});

module.exports = {
    app: app,
    authenticate: true,
    csss: ['css/menu.css'],
    javascripts: [
        'js/module.js',
        'js/services/servercall.js'
    ]
};
