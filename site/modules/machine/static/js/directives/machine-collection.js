'use strict';

(function (app) {
    app.directive('machineCollection', ['Machine', 'PopupDialog', 'localization', function (Machine, PopupDialog, localization) {
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
                    scope.internalCollection.push({
                        key: '',
                        val: '',
                        edit: true,
                        isNew: true,
                        dirtyKey: '',
                        dirtyVal: ''
                    });
                };
                scope.loadCollection = function () {
                    function convertCollection() {
                        scope.internalCollection = [];
                        for (var key in scope.collection) {
                            if (key !== 'root_authorized_keys' && key !== 'credentials') {
                                scope.internalCollection.push({
                                    key: key,
                                    val: scope.collection[key],
                                    dirtyKey: key,
                                    dirtyVal: scope.collection[key]
                                });
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
                scope.saveCollection = function (obj) {
                    var newCollection = {};
                    var hasDuplicates = false;
                    obj = obj || {};
                    scope.internalCollection.forEach(function (item) {
                        if (item.dirtyKey && item.dirtyVal) {
                            if (obj.isNew || (item.key === obj.key && item.val === obj.val)) {
                                obj.key = obj.dirtyKey;
                                obj.val = obj.dirtyVal;
                            }
                        }
                        hasDuplicates = hasDuplicates || newCollection[item.key];
                        if (item.key && item.val) {
                            newCollection[item.key] = item.val;
                        }
                    });
                    var persistCollection = function () {
                        if (scope.machineId) {
                            scope.saving = true;
                            Machine[scope.collectionName](scope.machineId, newCollection).then(function () {
                                scope.loadCollection();
                                scope.saving = false;
                            });
                        } else {
                            scope.collection = newCollection;
                            scope.loadCollection();
                        }
                    };

                    if (hasDuplicates) {
                        PopupDialog.confirm(
                            null,
                            localization.translate(scope, null,
                                'This {{name}} key already exists. Previous value will be lost. Are you sure?',
                                {
                                    name: scope.collectionName.replace(/s$/, '')
                                }
                            ),
                            persistCollection
                        );
                    } else {
                        persistCollection();
                    }

                };
                scope.addItem = function (item) {
                    scope.saveCollection(item);
                };
                scope.editItem = function (item) {
                    item.edit = true;
                };
                scope.removeItem = function (item) {
                    var collection = scope.internalCollection;
                    var itemIndex = collection.indexOf(item);

                    collection.splice(itemIndex, 1);

                    if (collection[collection.length - 1].isNew) {
                        collection.splice(collection.length - 1, 1);
                    }
                    scope.saveCollection();
                };
                scope.$watch('collection', function () {
                    scope.loadCollection();
                });
            }
        };
    }]);
}(window.JP.getModule('Machine')));