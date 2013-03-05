'use strict';


var express = require('express');
var assert = require('assert');
var app = express();

var EventEmmiter = require('events').EventEmitter

var clientEvents = new EventEmmiter();

JP.registerModuleAPI("event", {
    registerEvent: function(event, listener){
        clientEvents.addListener(event, listener);
    },
    sendEvent: function(event, data){

    }
});

app.get('/', function (req, res) {

});

app.post('/', function (req, res) {
    clientEvents
});

module.exports = {
    csss: ['css/menu.css'],
    javascripts: [
        'js/module.js',
        'js/services/events.js'
    ]
};
