'use strict';

JoyentPortal.config(function($routeProvider) {
	$routeProvider
		.when('/signup', {
			action: 'signup.index'
		}
	);
});

JoyentPortal.run(function(Menu){
  Menu.register({
    name:'Signup',
    link:'signup'
  });
});
