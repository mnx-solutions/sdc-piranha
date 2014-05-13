'use strict';

(function (app) {
    app.directive('rename', [ 'localization', 'PopupDialog', '$timeout', 'Image', 'Machine', '$$track', function (localization, PopupDialog, $timeout, Image, Machine, $$track) {
        return {
            restrict: 'EA',
            scope: {
                object: '=',
                type: '='
            },

            link: function (scope) {
                scope.type = String(scope.type);
                scope.incorrectNameMessage = "can contain only letters, digits and signs like '.' and '-'.";
                scope.enableRename = function (name) {
                    scope.changingName = true;
                    scope.newName = name;
                    $timeout(function () {
                        angular.element('#renameObject').focus();
                    });
                };

                var renameFinished = function () {
                    scope.renaming = false;
                    scope.loadingNewName = false;
                };

                scope.cancelRename = function () {
                    scope.changingName = false;
                };

                scope.clickRename = function () {
                    if (scope.object.name === scope.newName) {
                        return;
                    }
                    var currentName = scope.object.name;
                    scope.object.name = scope.newName;
                    PopupDialog.confirm(
                        localization.translate(
                            scope,
                            null,
                            'Confirm: Rename ' + scope.type
                        ),
                        localization.translate(
                            scope,
                            null,
                            'Rename this ' + scope.type
                        ), function () {
                            scope.loadingNewName = true;
                            scope.changingName = false;
                            scope.renaming = true;

                            if (scope.type && scope.type === 'image') {
                                Image.renameImage(scope.object, function () {
                                    renameFinished();
                                });
                            } else {
                                $$track.event('machine', 'rename');
                                var job = Machine.renameMachine(scope.object.id, scope.newName);
                                job.getJob().done(function () {
                                    renameFinished();
                                });
                            }
                        }, function () {
                            scope.object.name = currentName;
                        }
                    );
                };
            },

            templateUrl: 'machine/static/partials/rename.html'
        };
    }]);
}(window.JP.getModule('Machine')));