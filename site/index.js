'use strict';

var express = require('express');
var app = express();

app.use(express.bodyParser());

var Modulizer = require('../lib/modulizer');
var modulizer = new Modulizer(app);

modulizer.loadApps(['main','home','login']);

modulizer.loadModuleStack(function(){
    
  modulizer.registerApps();
  
  app.listen(3000);
});