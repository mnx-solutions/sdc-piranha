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
            link: function (scope) {
                var lastEditItem = null;
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
                            if (key !== 'root_authorized_keys' && key !== 'credentials' && key !== 'prepare-image:error' && key !== 'prepare-image:state') {
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
                        Machine[scope.collectionName].read(scope.machineId).then(function (collection) {
                            scope.collection = collection;
                            convertCollection();
                        });
                    } else {
                        convertCollection();
                    }
                };
                scope.loadCollection();

                function updateCollection() {
                    var newCollection = {};
                    scope.internalCollection.forEach(function (collection) {
                        if (!collection.isNew) {
                            newCollection[collection.dirtyKey] = collection.dirtyVal;
                        }
                    });
                    scope.collection = newCollection;
                }

                function hasDuplicate(item) {
                    return scope.internalCollection.find(function (el) {
                        return el && el.key === item.dirtyKey;
                    });
                }

                function removeItem(item) {
                    var index = scope.internalCollection.indexOf(item);
                    if (index !== -1) {
                        scope.internalCollection.splice(index, 1);
                    }
                }

                scope.addItem = function (item) {
                    if (scope.saving) {
                        return;
                    }

                    var prevKey = item.key;
                    var prevVal = item.val;
                    var keyToUpdate = item.key;
                    var data = {};
                    scope.saving = item.saving = true;

                    if (lastEditItem && lastEditItem !== item && !lastEditItem.isNew) {
                        scope.revertItem(lastEditItem);
                    }

                    data[item.dirtyKey] = item.dirtyVal;

                    function done() {
                        scope.saving = item.saving = false;
                        scope.loadCollection();
                    }

                    function fail(error) {
                        if (error) {
                            PopupDialog.error(null, error);
                        }
                        if (!item.isNew) {
                            item.key = item.dirtyKey = prevKey;
                            item.val = item.dirtyVal = prevVal;
                        }
                        item.saving = scope.saving = false;
                        scope.loadCollection();
                    }
                    
                    function doCreate() {
                        Machine[scope.collectionName].create(scope.machineId, data).then(done, fail);
                    }

                    function doUpdate() {
                        Machine[scope.collectionName].update(scope.machineId, keyToUpdate, data).then(done, fail);
                    }

                    function createOrUpdate() {
                        if (!scope.machineId) {
                            if (!item.isNew) {
                                removeItem(item);
                                updateCollection();
                            }
                            scope.collection[item.dirtyKey] = item.dirtyVal;
                            scope.loadCollection();
                            item.saving = scope.saving = false;
                        } else {
                            if (item.isNew) {
                                doCreate();
                                return;
                            }

                            doUpdate();
                            removeItem(duplicate);
                        }
                    }

                    var duplicate = hasDuplicate(item);
                    if (duplicate) {
                        PopupDialog.confirm(
                            null,
                            localization.translate(scope, null,
                                'This {{name}} key already exists. Previous value will be lost. Are you sure?',
                                {
                                    name: scope.collectionName.replace(/s$/, '')
                                }
                            ),
                            createOrUpdate,
                            fail
                        );
                    } else {
                        createOrUpdate();
                    }
                    item.key = item.dirtyKey;
                    item.val = item.dirtyVal;
                };

                scope.editItem = function (item) {
                    if (lastEditItem && lastEditItem !== item && !lastEditItem.isNew) {
                        scope.revertItem(lastEditItem);
                    }
                    item.edit = item.isNew || !scope.saving;
                    lastEditItem = item;
                };

                scope.removeItem = function (item) {
                    if (scope.saving) {
                        return;
                    }
                    if (lastEditItem && !lastEditItem.isNew) {
                        scope.revertItem(lastEditItem);
                    }
                    item.saving = scope.saving = true;
                    if (scope.machineId) {
                        Machine[scope.collectionName].delete(scope.machineId, item.key).then(function () {
                            scope.saving = false;
                            removeItem(item);
                            scope.loadCollection();
                        });
                    } else {
                        removeItem(item);
                        updateCollection();
                        scope.saving = false;
                        scope.loadCollection();
                    }
                };

                scope.revertItem = function (item) {
                    item.dirtyKey = item.key;
                    item.dirtyVal = item.val;
                    item.edit = false;
                };

                scope.$watch('collection', function () {
                    if (!scope.machineId) {
                        scope.loadCollection();
                    }
                });
            }
        };
    }]);
}(window.JP.getModule('Machine')));