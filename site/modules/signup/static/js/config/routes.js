JoyentPortal.config(function($routeProvider) {
  $routeProvider
    .when('/signup', {
      action: 'signup.home'
    });
});

JoyentPortal.run(function(Menu){
  Menu.register({
    name:'Signup',
    link:'signup'
  });
});
