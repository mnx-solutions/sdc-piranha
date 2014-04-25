'use strict';

window.JP.main.provider('route', [
    '$routeProvider',
    function ($routeProvider) {
        function Provider() {
            this._navigation = [];
        }

        Provider.prototype._findRootContext = function (action) {
            if (!action) {
                return null;
            }
            for (var i = 0, c = this._navigation.length; i < c; i++) {
                // Direct resolve
                if (this._navigation[i].action === action) {
                    return this._navigation[i];
                }

                // Resolve by module prefix
                var p1 = this._navigation[i].action.split('.');
                var p2 = action && action.split('.');

                if (p2 && p1[0] === p2[0]) {
                    return this._navigation[i];
                }
            }

            return null;
        };

        Provider.prototype._matchParams = function (params, context) {
            var keys = params ? Object.keys(params) : [];

            if (keys.length === 0 && /:(\w+)/ig.test(context.path)) {
                return false;
            }

            if (keys.length > 0) {
                var match = true;

                for (var i = 0, c = keys.length; i < c; i++) {
                    var key = keys[i];

                    if (context.path.indexOf(':' + key) === -1) {
                        match = false;
                        break;
                    }
                }

                return match;
            }

            return true;
        };

        Provider.prototype._findNavigationContext = function (action, params, context) {
            context = context ? context : null;

            if (!context) {
                context = this._findRootContext(action);
            }

            if (context) {
                if (context.action === action && this._matchParams(params, context)) {
                    return context;
                }

                for (var i = 0, c = context.children.length; i < c; i++) {
                    var childContext = this._findNavigationContext(action, params, context.children[i]);
                    if (childContext) {
                        return childContext;
                    }
                }
            }

            return null;
        };

        Provider.prototype._buildNavigationPath = function (action, params, context) {
            var navigationPath = [];
            context = context ? context : null;

            if (!context) {
                context = this._findRootContext(action);
            }

            if (context) {
                if (context.parent) {
                    var parentContext = this._findRootContext(context.parent);
                    navigationPath = this._buildNavigationPath(context.parent, params, parentContext);
                }

                if (context.children.length > 0 || 
                    (context.action === action  && this._matchParams(params, context))) {
                    navigationPath.push({
                        title: context.title,
                        path: context.path,
                        params: params,
                        showLatest: context.showLatest,
                        showText: context.showText
                    });
                }

                if (context.action === action && this._matchParams(params, context)) {
                    return navigationPath;
                }

                for (var a = 0, c = context.children.length; a < c; a++) {
                    var childContext = this._buildNavigationPath(action, params, context.children[a]);
                    if (childContext) {
                        navigationPath = navigationPath.concat(childContext);
                    }
                }

                if (context.parent) {
                    navigationPath = navigationPath.concat(this._buildNavigationPath(context.parent, params, this._findRootContext(context.parent)));
                }
            }

            return navigationPath;
        };

        Provider.prototype.registerNavigation = function (path, route) {
            var navigationPath = route.action.split('.');

            if (navigationPath.length > 0) {
                var context = {};
                context.title = route.title;
                context.action = route.action;
                context.path = path;
                context.children = [];
                context.parent = route.parent;
                context.showLatest = route.showLatest;
                context.showText = route.showText;

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

        Provider.prototype.resolveNavigation = function (action, params) {
            var currentContext = this._findNavigationContext(action, params);
            var navigationPath = [];
            if (currentContext) {
                navigationPath = this._buildNavigationPath(action, params);
            }

            return navigationPath;
        };

        var provider = new Provider();

        return {
            $get: [ '$route', function ($route) {
                return {
                    registerNavigation: provider.registerNavigation,
                    resolveNavigation: function () {
                        return provider.resolveNavigation(
                            this.$route.current.$$route.action,
                            this.$route.current.pathParams
                        );
                    },

                    $route: $route
                }
            }],

            when: function (path, route) {
                if (route.action) {
                    provider.registerNavigation(path, route);
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