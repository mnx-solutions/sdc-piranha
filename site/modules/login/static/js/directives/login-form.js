'use strict';

(function (app) {
    app.directive('loginForm', function () {
        return {
            restrict: 'C',
            template: '<div class="container">' +
'<form class="form-signin" name="login" ' +
' data-ng-controller="LoginFormController">' +
'<h2 class="form-signin-heading">Please sign in</h2>' +
'<p>This is a temporary login that will be replaced by SSO</p>' +
'<input type="text" class="input-block-level" placeholder="Username" ' +
' data-ng-model="login.username" required>' +

'<input type="password" class="input-block-level"' +
' placeholder="Password" data-ng-model="login.password" required>' +

'</label>' +
'<button class="btn btn-large btn-primary" data-ng-click="logIn()">'+
'Sign in</button>' +
'</form>' +
'</div>'
        };
    });
}(window.JP.getModule('Login')));
