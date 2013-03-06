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
        if (callHandlers[call]){
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

app.get('/call', function (req, res) {
    if (!req.session.callResults){
        req.session.callResults = [];
    }

    res.json(req.session.callResults);
    req.session.callResults = [];
});

app.post('/call', function (req, res) {
    var call = req.body;

    if (!req.session.callResults){
        req.session.callResults = [];
    }

    logger.debug("Handling client call", call)

    var handler = callHandlers[call.name];
    if (handler){
        handler(function(err, result){
            req.session.callResults.push({
                name: call.name,
                id: call.id,
                error: err,
                result: result
            });
        });
    } else {
        logger.warn("Unhandled call {} called", call);
    }
});

module.exports = {
    app: app,
    authenticate: true,
    csss: ['css/menu.css'],
    javascripts: [
        'js/module.js',
        'js/services/events.js',
        'js/services/servercall.js'
    ]
};
