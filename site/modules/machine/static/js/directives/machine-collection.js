'use strict';

(function (app) {
    app.directive('machineCollection', [function () {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                collection: '=',
                collectionName: '=',
                machine: '='
            },

            controller: function ($scope, Machine, $$track) {

                $scope.collectionSaving = false;

                function initCollection(collection) {
                    $scope.collection = [];
                    $scope.collectionSaving = false;
                    Object.keys(collection).forEach(function (key) {
                        if (key !== 'root_authorized_keys' && key !== 'credentials') {
                            $scope.collection.push({key: key, val: collection[key], conflict: false, edit: false});
                        }
                    });
                    $scope.showCollectionSave = !!$scope.collection.length;
                    $scope.collectionSaveOk = $scope.showCollectionSave;
                }

                var loadCollection = function () {
                    if ($scope.machine) {
                        Machine[$scope.collectionName]($scope.machine.id).then(initCollection);
                    } else {
                        setTimeout(loadCollection, 100);
                    }
                };
                loadCollection();

                $scope.$watch('collection', function (newVal) {
                    var collectionSaveOk = true;
                    // Search for conflicts
                    var keyMap = {};
                    newVal.forEach(function (item, index) {
                        if (keyMap[item.key]) {
                            item.conflict = true;
                            keyMap[item.key].conflict = true;
                            collectionSaveOk = false;
                        } else if (!item.key && index !== (newVal.length - 1)) {
                            item.conflict = true;
                            collectionSaveOk = false;
                        } else {
                            item.conflict = false;
                            keyMap[item.key] = item;
                        }
                    });
                    $scope.collectionSaveOk = collectionSaveOk;

                }, true);

                $scope.add = function () {
                    $scope.collection.push({key: '', val: '', edit: true, conflict: false});
                    $scope.showCollectionSave = true;
                };

                $scope.edit = function (index) {
                    $scope.collection[index].edit = true;
                };

                $scope.remove = function (index) {
                    $scope.collection.splice(index, 1);
                };

                $scope.save = function () {
                    $$track.event('machine', 'save ' + $scope.collectionName);

                    var data = {};
                    $scope.collection.forEach(function (item) {
                        if (item.key && item.val) {
                            data[item.key] = item.val;
                        }
                    });

                    $scope.collectionSaving = true;
                    Machine[$scope.collectionName]($scope.machine.id, data).then(initCollection);
                };

                $scope.singleCollectionName = function () {
                    var str = $scope.collectionName;
                    if (str.charAt(str.length - 1) === 's') {
                        str = str.slice(0, -1);
                    }
                    return str.charAt(0).toUpperCase() + str.slice(1);
                };
            },

            templateUrl: 'machine/static/partials/machine-collection.html'
        };
    }]);
}(window.JP.getModule('Machine')));