'use strict';

(function (ng, app) {
    app.directive('tree', [function () {
        return {
            restrict: 'EA',
            scope: {
                objects: '=',
                arrayName: '='
            },
            link: function (scope, $element, attrs) {
                scope.noCheckbox = false;
                if (attrs.hasOwnProperty('noCheckbox')) {
                    scope.noCheckbox = true;
                }
                scope.$watch('objects', function () {
                    if (!(scope.objects && scope.objects.length)) {
                        return;
                    }
                    setTimeout(function () {
                        angular.element($element).on('changed.jstree', function (e, data) {
                            scope.objects.forEach(function (group) {
                                group.values.forEach(function (item) {
                                    item.checked = false;
                                });
                            });
                            var j = data.selected.length;

                            for (var i = 0; i < j; i++) {
                                var selectedNode = data.instance.get_node(data.selected[i]);
                                if (!selectedNode.children.length) {
                                    scope.objects.forEach(function (item) {
                                        item.values.some(function (value) {
                                            value.checked = value.checked || value.id === selectedNode.li_attr.id;
                                        });
                                    });
                                }
                            }
                        }).jstree({
                            core: {
                                themes: {
                                    icons: false
                                }
                            },
                            sort: function (a, b) {
                                return this.get_text(a) > this.get_text(b) ? 1 : -1;
                            },
                            checkbox: !scope.noCheckbox && {
                                keep_selected_style: false
                            },
                            plugins: [ "checkbox", "sort" ]
                        });
                    }, 0);
                });

            },

            templateUrl: 'rbac/static/partials/tree.html'
        };
    }]);
}(window.angular, window.JP.getModule('rbac')));
