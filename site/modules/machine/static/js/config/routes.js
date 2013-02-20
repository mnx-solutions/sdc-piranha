'use strict';

JoyentPortal.config(function($routeProvider) {
  $routeProvider
    .when('/machine', {
      action: 'machine.index'
    })
    .when('/machine/details', {
      action: 'machine.details'
    });
});

JoyentPortal.run(function(Menu){
  Menu.register({
    name:'Machine',
    link:'machine'
  });
});
