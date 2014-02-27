'use strict';

(function (app) {
    app.directive('machineCollection', ['Machine', function (Machine) {
        return {
            templateUrl: 'machine/static/partials/machine-collection.html',
            restrict: 'EA',
            scope: {
                collection: '=',
                collectionName: '=',
                machineId: '=',
                review: '='
            },
            link: function (scope, element, attrs) {
                scope.internalCollection = [];
                scope.addNew = function () {
                    scope.internalCollection.push({key: '', value: '', edit: true, isNew: true});
                };
                scope.loadCollection = function () {
                    function convertCollection() {
                        scope.internalCollection = [];
                        for (var key in scope.collection) {
                            if (key !== 'root_authorized_keys' && key !== 'credentials') {
                                scope.internalCollection.push({key: key, val: scope.collection[key]});
                            }
                        }
                        scope.addNew();
                    }
                    if (scope.machineId) {
                        Machine[scope.collectionName](scope.machineId).then(function (collection) {
                            scope.collection = collection;
                            convertCollection();
                        });
                    } else {
                        convertCollection();
                    }
                };
                scope.loadCollection();
                scope.saveCollection = function () {
                    scope.collection = {};
                    scope.internalCollection.forEach(function (item) {
                        if (item.key && item.val) {
                            scope.collection[item.key] = item.val;
                        }
                    });
                    if (scope.machineId) {
                        scope.saving = true;
                        Machine[scope.collectionName](scope.machineId, scope.collection).then(function () {
                            scope.loadCollection();
                            scope.saving = false;
                        });
                    } else {
                        scope.loadCollection();
                    }
                };
                scope.addItem = function () {
                    scope.saveCollection();
                };
                scope.editItem = function (item) {
                    item.edit = true;
                };
                scope.removeItem = function (item) {
                    var itemIndex = scope.internalCollection.indexOf(item);
                    scope.internalCollection.splice(itemIndex, 1);
                    scope.saveCollection();
                };
            }
        };
    }]);
}(window.JP.getModule('Machine')));