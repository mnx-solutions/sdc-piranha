'use strict';

(function (app) {
    app.directive('machineCollection', ['Machine', function (Machine) {
        return {
            templateUrl: 'machine/static/partials/machine-collection.html',
            restrict: 'EA',
            scope: {
                collection: '=',
                collectionName: '=',
                machineid: '=',
                review: '='
            },
            link: function (scope, element, attrs) {
                scope.internalCollection = [];
                scope.addNew = function addNew() {
                    scope.internalCollection.push({key: '', value: '', edit: true, isNew: true});
                };
                scope.loadCollection = function s() {
                    function convertCollection() {
                        scope.internalCollection = [];
                        for (var key in scope.collection) {
                            if (key !== 'root_authorized_keys' && key !== 'credentials') {
                                scope.internalCollection.push({key: key, val: scope.collection[key]});
                            }
                        }
                        scope.addNew();
                    }
                    if (scope.machineid) {
                        Machine[scope.collectionName](scope.machineid).then(function (collection) {
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
                    if (scope.machineid) {
                        scope.saving = true;
                        Machine[scope.collectionName](scope.machineid, scope.collection).then(function () {
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