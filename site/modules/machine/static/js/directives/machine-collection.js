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
                    var newCollection = {};
                    var hasDuplicates = false;
                    scope.internalCollection.forEach(function (item) {
                        if (item.key && item.val) {
                            hasDuplicates = hasDuplicates || newCollection[item.key];
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