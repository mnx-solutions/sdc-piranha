'use strict';

window.JP.main.provider('route', [
    '$routeProvider',
    function ($routeProvider) {
        function Provider() {
            this._navigation = [];
        }

        Provider.prototype._findNavigationContext = function (action, context) {
            context = context ? context : null;

            if (!context) {
                for (var i = 0, c = this._navigation.length; i < c; i++) {
                    // Direct resolve
                    if (this._navigation[i].action === action) {
                        context = this._navigation[i];
                        break;
                    }

                    // Resolve by module prefix
                    var p1 = this._navigation[i].action.split('.');
                    var p2 = action.split('.');

                    if (p1[0] === p2[0]) {
                        context = this._navigation[i];
                        break;
                    }
                }
            }

            if (context) {
                if (context.action === action) {
                    return context;
                }

                for (var i = 0, c = context.children.length; i < c; i++) {
                    var childContext = this._findNavigationContext(action, context.children[i]);
                    if (childContext) {
                        return childContext;
                    }
                }
            }

            return null;
        };

        Provider.prototype._buildNavigationPath = function (action, context) {
            var navigationPath = [];
            context = context ? context : null;

            if (!context) {
                for (var i = 0, c = this._navigation.length; i < c; i++) {
                    // Direct resolve
                    if (this._navigation[i].action === action) {
                        context = this._navigation[i];
                        break;
                    }

                    // Resolve by module prefix
                    var p1 = this._navigation[i].action.split('.');
                    var p2 = action.split('.');

                    if (p1[0] === p2[0]) {
                        context = this._navigation[i];
                        break;
                    }
                }
            }

            if (context) {
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
                    var parentContext = this._findNavigationContext(parentPath) || 
                        this._findNavigationContext(parentPath + '.index');

                    if (parentContext) {
                        parentContext.children.push(context);
                    } else {
                        this._navigation.push(context);
                    }
                }
            }
        };

        Provider.prototype.resolveNavigation = function (action) {
            //console.log(this._navigation);
            var currentContext = this._findNavigationContext(action);

            //console.log(action);
            //console.log(currentContext);
            //console.log('------------');

            if (currentContext) {
                return this._buildNavigationPath(currentContext.action);
            }

            return [];
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