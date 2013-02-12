'use strict';

var express = require('express');
var app = express();

var Modulizer = require('../lib/modulizer');
var modulizer = new Modulizer(app);

modulizer.loadApps([]);

modulizer.loadModuleStack(function(){
    
  modulizer.registerApps();
  
  app.listen(3000);
});