'use strict';

(function (ng, app) {
    app.directive('tree', [function () {
        return {
            restrict: 'EA',
            scope: {
                objects: '='
            },
            link: function (scope, $element, attrs) {
                var plugins = ['sort'];
                var initialized = false;
                var objectsById = {};
                var objectIndex = 0;
                var useCheckboxes = false;

                if (!attrs.hasOwnProperty('noCheckbox')) {
                    plugins.push('checkbox');
                    useCheckboxes = true;
                }

                function normalizeObjects(objects) {
                    if (!Array.isArray(objects)) {
                        return;
                    }
                    objects.forEach(function (object) {
                        object.text = object.name;
                        if (useCheckboxes) {
                            object.id = object.id || 'o' + objectIndex;
                            objectsById[object.id] = object;
                            object.state = object.state || {};
                            object.state.selected = object.state.opened = !!object.checked;
                        }
                        normalizeObjects(object.children);
                    });
                }

                scope.$watch('objects', function () {
                    var objects = scope.objects;
                    if (!(scope.objects && scope.objects.length)) {
                        objects = [];
                    }

                    objectsById = {};
                    normalizeObjects(objects);

                    if (initialized) {
                        $element.jstree(true).settings.core.data = objects;
                        $element.jstree(true).load_node('#');
                        return;
                    }
                    initialized = true;
                    var tree = $element.jstree({
                        core: {
                            data: objects,
                            themes: {
                                icons: false
                            }
                        },
                        sort: function (a, b) {
                            return this.get_text(a) > this.get_text(b) ? 1 : -1;
                        },
                        checkbox: useCheckboxes && {
                            keep_selected_style: false
                        },
                        plugins: plugins
                    });
                    function changeState(event, object) {
                        objectsById[object.node.id].checked = object.node.state.selected;
                        object.node.parents.forEach(function (id) {
                            if (objectsById[id]) {
                                objectsById[id].checked = object.node.state.selected;
                            }
                        });
                    }
                    if (useCheckboxes) {
                        tree.on('select_node.jstree', changeState);
                        tree.on('deselect_node.jstree', changeState);
                    }
                });

            },

            template: '<div></div>'
        };
    }]);
}(window.angular, window.JP.getModule('rbac')));
