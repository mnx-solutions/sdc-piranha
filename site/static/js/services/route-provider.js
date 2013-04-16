'use strict';

window.JP.main.provider('route', [
    '$routeProvider',
    function ($routeProvider) {
        function Provider() {
            this._navigation = [];
        }

        Provider.prototype._findNavigationContext = function (navigationPath, context) {
            context = context ? context : this._navigation[0];

            if (context.action === navigationPath) {
                return context;
            }

            for (var a = 0, c = context.children.length; a < c; a++) {
                var childContext = this._findNavigationContext(navigationPath, context.children[a]);
                if (childContext) {
                    return childContext;
                }
            }

            return null;
        };

        Provider.prototype._findNavigationAction = function (action, context) {
            context = context ? context : this._navigation[0];

            //console.log(context.action);
            //console.log(action);
            //console.log('------------');

            if (context.action === action) {
                return context;
            }

            //console.log(context.children);
            for (var a = 0, c = context.children.length; a < c; a++) {
                var childContext = this._findNavigationAction(action, context.children[a]);
                if (childContext) {

                    return childContext;
                }
            }

            return null;
        };

        Provider.prototype._buildNavigationPath = function (action, context) {
            var navigationPath = [];
            context = context ? context : this._navigation[0];

            if (context.children.length > 0 || context.action === action) {
                navigationPath.push({
                    title: context.title,
                    path: context.path
                });
            }

            if (context.action === action) {
                return navigationPath;
            }

            for (var a = 0, c = context.children.length; a < c; a++) {
                var childContext = this._buildNavigationPath(action, context.children[a]);
                if (childContext) {
                    navigationPath = navigationPath.concat(childContext);
                }
            }

            return navigationPath;
        };

        Provider.prototype.registerNavigation = function (path, action, title) {
            var navigationPath = action.split('.');
            if (navigationPath.length > 0) {
                var context = {};
                context.title = title;
                context.action = action;
                context.path = path;
                context.children = [];

                if (this._navigation.length === 0) {
                    this._navigation.push(context);
                } else {
                    var parentPath = navigationPath.slice(0, navigationPath.length - 1).join('.');
                    var parentContext = this._findNavigationContext(parentPath) || this._navigation[0];
                    parentContext.children.push(context);
                }
            }
        };

        Provider.prototype.resolveNavigation = function (action, context) {
            var currentContext = this._findNavigationAction(action) ||
                (this._navigation.length > 0 ? this._navigation[0] : null);

            return this._buildNavigationPath(currentContext.action);
        };

        var provider = new Provider();

        return {
            $get: [ '$route', function ($route) {
                return {
                    registerNavigation: provider.registerNavigation,
                    resolveNavigation: function () {
                        return provider.resolveNavigation(this.$route.current.$$route.action);
                    },

                    $route: $route
                }
            }],

            when: function (path, route) {
                if (route.action) {
                    provider.registerNavigation(path, route.action, route.title);
                }

                $routeProvider.when(path, route);
                return this;
            },

            otherwise: function (params) {
                $routeProvider.otherwise(params);
                return this;
            }
        };
}]);