'use strict';

window.JoyentPortal.config(function($routeProvider) {
  $routeProvider
    .when('/machine', {
      action: 'machine.index'
    })
    .when('/machine/details/:machineid', {
      action: 'machine.details'
    });
});

window.JoyentPortal.run(function(Menu){
  Menu.register({
    name:'Machine',
    link:'machine'
  });
});
