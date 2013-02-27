'use strict';

(function (ng, app) {
	app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
		return {
			link: function (scope, element, attrs) {
				scope.mainMenu = Menu.getMenu();
			},

			controller: function ($scope, requestContext) {
				$scope.$on('requestContextChanged', function () {
					$scope.mainMenu.forEach(function (item) {
						item.active = requestContext.startsWith(item.link);
					});
				});
			},

			template: '<ul class="nav nav-list">' +
					'<li data-ng-repeat="item in mainMenu" class="menuitem" data-ng-class="{active: item.active}">' +
						'<a href="#!/{{item.link}}">{{item.name}}</a>' +
					'</li>' +
				'</ul>'
		};
	}]);
}(window.angular, window.JP.getModule('Menu')));