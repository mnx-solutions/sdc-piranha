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
                return notifications.map(function (notification) {
                    return {
                        type: notification.opts.type,
                        message: notification.message
                    };
                });
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
                    timeout: 5000
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

                    $timeout(function () {
                        var notifications = self._findById(id);
                        if (notifications.length !== 0) {
                            self.dismiss(notifications[0].ctx);
                        }
                    }, parseInt(opts.timeout));
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
            dismiss: function (ctx) {
                var contextNotifications =
                    ctx ? this._findByContext(ctx) : notifications;

                notifications = notifications.filter(function (notification) {
                    if (contextNotifications.indexOf(notification) !== -1) {
                        return false;
                    }

                    return true;
                });

                $rootScope.$broadcast('notification:change');
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
            }
        };
    }]);
}(window.angular, window.JP.getModule('notification')));