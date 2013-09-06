'use strict';

(function (ng, app) {
    app.factory('notification', [ '$timeout', '$rootScope',
        function ($timeout, $rootScope) {
        var notifications = [];

        return {
            /**
             * Build find method
             *
             * @private
             * @param prop property name
             * @param value property value
             * @returns {Array}
             */
            _find: function (prop, value) {
                var contextNotifications = [];

                if (!value || value === null) {
                    return contextNotifications;
                }

                for (var i = 0, c = notifications.length; i < c; i++) {
                    var notification = notifications[i];
                    if (notification.hasOwnProperty(prop) &&
                        notification[prop] === value) {
                        contextNotifications.push(notification);
                    }
                }

                return contextNotifications;
            },

            /**
             * Find by context
             *
             * @private
             * @param ctx notification context
             * @returns {Array}
             */
            _findByContext: function (ctx) {
                return this._find('ctx', ctx);
            },

            /**
             * Find by id
             *
             * @private
             * @param id notification uuid
             * @returns {Array}
             */
            _findById: function (id) {
                return this._find('id', id);
            },

            /**
             * Detects if notification context is active
             *
             * @public
             * @param ctx notification context
             * @returns {boolean}
             */
            isVisible: function (ctx) {
                return this._findByContext(ctx).length > 0;
            },

            /**
             * Return notifications stack
             *
             * @returns {Object}
             */
            getNotifications: function () {
                var groups = {};

                // Group by context
                for (var i = 0, c = notifications.length; i < c; i++) {
                    var n = notifications[i];
                    var ctx = (n.ctx && typeof n.ctx === 'object' ? JSON.stringify(n.ctx) : n.ctx || 'default');

                    if (!groups[ctx]) {
                        groups[ctx] = {};
                    }

                    if (!groups[ctx][n.opts.type]) {
                        groups[ctx][n.opts.type] = [];
                    }

                    groups[ctx][n.opts.type].push(n);
                }

                return groups;
            },

            /**
             * Push a new notification
             *
             * @public
             * @event notification:change
             * @param ctx notification context
             * @param opts notification options
             * @param message notification message
             */
            push: function (ctx, opts, message) {
                var defaultOpts = {
                    type: 'success',
                    force: false,
                    timeout: -1,
                    group: true
                };

                if (message === undefined) {
                    message = opts;
                } else {
                    ng.extend(defaultOpts, opts);
                }

                opts = defaultOpts;

                if (this.isVisible(ctx)) {
                    this.dismiss(ctx);
                }

                var id = window.uuid.v4();

                // Timeout
                if (opts.timeout && opts.timeout !== -1) {
                    var self = this;

                    (function(id, group) {
                        $timeout(function () {
                            if (group) {
                                self.dismiss(null, id);
                            } else {
                                var notifications = self._findById(id);
                                if (notifications.length !== 0) {
                                    self.dismiss(notifications[0].ctx);
                                }
                            }
                        }, parseInt(opts.timeout));
                    })(id, opts.group);
                }

                notifications.unshift({
                    id: id,
                    ctx: ctx,
                    opts: opts,
                    message: message
                });

                $rootScope.$broadcast('notification:change');
            },

            /**
             * Dismiss the context
             *
             * @public
             * @event notification:change
             * @param ctx notification context
             */
            dismiss: function (ctx, id) {
                var contextNotifications =
                    ctx ? this._findByContext(ctx) : notifications;

                if (id) {
                    notifications = notifications.filter(function (notification) {
                        if (id && notification.id === id) {
                            return false;
                        }

                        return true;
                    });
                } else {
                    notifications = notifications.filter(function (notification) {
                        if (contextNotifications.indexOf(notification) !== -1) {
                            return false;
                        }

                        return true;
                    });
                }

                $rootScope.$broadcast('notification:change');
            },

            /**
             * Replace all notifications for the given context with new one
             *
             * @public
             * @event notification:change
             * @param ctx notification context
             * @param opts notification options
             * @param message notification message
             */
            replace: function (ctx, opts, message) {
                this.dismiss(ctx);
                this.push(ctx, opts, message);
            },

            /**
             * Dismiss notification at stack index
             *
             * @public
             * @event notification:change
             * @param index notification index
             */
            dismissAtIndex: function (index) {
                if (index >= 0 && index <= (notifications.length - 1)) {
                    notifications.splice(index, 1);
                    $rootScope.$broadcast('notification:change');
                }
            },

            /**
             * Dismiss given notifications
             *
             * @public
             * @param _notifications
             */
            dismissNotifications: function (_notifications) {
                var changed = false;

                _notifications.forEach(function (n1) {
                    notifications.forEach(function (n2, index) {
                        if (n1.id === n2.id) {
                            changed = true;
                            notifications.splice(index, 1);
                        }
                    })
                });

                if (changed) {
                    $rootScope.$broadcast('notification:change');
                }
            }
        };
    }]);
}(window.angular, window.JP.getModule('notification')));