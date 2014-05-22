'use strict';

(function (ng, app) {
    app.directive('tree', [function () {
        return {
            restrict: 'EA',
            scope: {
                objects: '=',
                arrayName: '='
            },
            link: function (scope, $element) {
                setTimeout(function () {
                    angular.element($element).on('changed.jstree', function (e, data) {
                        //TODO handler
                        var selectedElements = [];
                        var j = data.selected.length;
                        for (var i = 0; i < j; i++) {
                            selectedElements.push(data.instance.get_node(data.selected[i]));
                        }
                        // console.log(selectedElements, data.selected);
                    }).jstree({
                        "core": {
                            "themes": {
                                "icons": false
                            }
                        },
                        "checkbox" : {
                            "keep_selected_style" : false
                        },
                        "plugins" : [ "checkbox" ]
                    });
                });
            },

            templateUrl: 'rbac/static/partials/tree.html'
        };
    }]);
}(window.angular, window.JP.getModule('Rbac')));