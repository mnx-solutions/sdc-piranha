'use strict';

(function (app) {
    app.directive('tags', ['Machine', function (Machine) {
        return {
            templateUrl: 'machine/static/partials/tags.html',
            restrict: 'EA',
            scope: {
                tags: '=',
                machineid: '=',
                review: '='
            },
            link: function (scope, element, attrs) {
                /*if ($scope.features.instanceTagging === 'enabled') {
                    $scope.tagcloud = tagcloud();
                }*/

                scope.internalTags = [];
                scope.addNew = function addNew() {
                    scope.internalTags.push({key: '', value: '', edit: true, isNew: true});
                };
                scope.loadTags = function loadTags() {
                    function convertTags() {
                        scope.internalTags = [];
                        for (var key in scope.tags) {
                            scope.internalTags.push({key: key, val: scope.tags[key]});
                        }
                        scope.addNew();
                    }
                    if (scope.machineid) {
                        Machine.tags(scope.machineid).then(function (tags) {
                            scope.tags = tags;
                            convertTags();
                        });
                    } else {
                        convertTags();
                    }
                };
                scope.loadTags();
                scope.saveTags = function saveTags() {
                    scope.tags = {};
                    scope.internalTags.forEach(function (tag) {
                        if (tag.key && tag.val) {
                            scope.tags[tag.key] = tag.val;
                        }
                    });
                    if (scope.machineid) {
                        scope.saving = true;
                        Machine.tags(scope.machineid, scope.tags).then(function () {
                            scope.loadTags();
                            scope.saving = false;
                        });
                    } else {
                        scope.loadTags();
                    }
                };
                scope.addTag = function () {
                    scope.saveTags();
                };
                scope.editTag = function (tag) {
                    tag.edit = true;
                };
                scope.removeTag = function (tag) {
                    var tagIndex = scope.internalTags.indexOf(tag);
                    scope.internalTags.splice(tagIndex, 1);
                    scope.saveTags();
                };
            }
        };
    }]);
}(window.JP.getModule('Machine')));