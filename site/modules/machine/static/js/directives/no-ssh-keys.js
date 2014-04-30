'use strict';

(function (app) {
    app.directive('noSshKeys', [function () {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                keys: '=keys'
            },
            templateUrl: 'machine/static/partials/no-ssh-keys.html'
        };
    }]);
}(window.JP.getModule('Machine')));