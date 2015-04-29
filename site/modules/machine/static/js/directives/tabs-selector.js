'use strict';

(function (app) {
    app.directive('tabsSelector', [ function () {
        return {
            restrict: 'EA',
            scope: {
                tabs: '=',
                activeTab: '='
            },

            link: function (scope) {
                scope.isActive = function (tab) {
                    return scope.activeTab === tab;
                };
                scope.setActive = function (tab) {
                    scope.activeTab = tab;
                };
            },

            templateUrl: 'machine/static/partials/tabs-selector.html'
        };
    }]);
}(window.JP.getModule('Machine')));
