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
                        dirtyVal: '',
                        saving: false
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
                                    dirtyVal: scope.collection[key],
                                    saving: false
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
                scope.saveCollection = function (collection, obj) {
                    var newCollection = {};
                    var hasDuplicates = false;
                    if (!collection) {
                        return;
                    }
                    obj = obj || {};
                    var progressOn = angular.noop;

                    collection.forEach(function (item) {
                        if (item.dirtyKey && item.dirtyVal) {
                            if (item.isNew || (item.key === obj.key && item.val === obj.val)) {
                                item.key = obj.key = obj.dirtyKey;
                                item.val = obj.val = obj.dirtyVal;
                                progressOn = function () {
                                    obj.saving = true;
                                };
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
                            function () {
                                obj.edit = obj.isNew;
                                progressOn();
                                persistCollection();
                            }
                        );
                    } else {
                        progressOn();
                        persistCollection();
                    }
                };
                scope.addItem = function (item) {
                    if (scope.saving) {
                        return;
                    }

                    var collection = angular.copy(scope.internalCollection);

                    var lastItem = collection[collection.length - 1];
                    if (lastItem.isNew && lastItem.key !== item.key) {
                        collection.splice(collection.length - 1, 1);
                    }
                    scope.saveCollection(collection, item);
                };
                scope.editItem = function (item) {
                    item.edit = item.isNew || !scope.saving;
                };

                scope.removeItem = function (item) {
                    if (scope.saving) {
                        return;
                    }
                    item.saving = true;
                    var internalCollection = scope.internalCollection;
                    var itemIndex = internalCollection.indexOf(item);
                    var collection = angular.copy(internalCollection);
                    collection.splice(itemIndex, 1);
                    if (collection[collection.length - 1].isNew) {
                        collection.splice(collection.length - 1, 1);
                    }
                    scope.saveCollection(collection);
                };
                scope.$watch('collection', function () {
                    scope.loadCollection();
                });
            }
        };
    }]);
}(window.JP.getModule('Machine')));