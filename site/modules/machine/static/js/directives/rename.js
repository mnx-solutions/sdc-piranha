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
                scope.clearNameTimeout = null;
                scope.type = String(scope.type);
                var currentName;
                scope.isRenameAvailable = function () {
                    return !(scope.object && scope.object.job && !scope.object.job.finished);
                };

                scope.enableRename = function (name) {
                    if (scope.isRenameAvailable()) {
                        scope.changingName = true;
                        scope.newName = name;
                        $timeout(function () {
                            angular.element('#renameObject').focus();
                        });
                    }
                };

                var renameFinished = function (err) {
                    if(err) {
                        scope.object.name = currentName;
                        PopupDialog.errorObj(err);
                    }
                    scope.renaming = false;
                    scope.loadingNewName = false;
                    scope.newName = '';
                };

                scope.cancelRename = function () {
                    scope.changingName = false;
                    scope.newName = '';
                };

                scope.clickRename = function () {
                    clearTimeout(scope.clearNameTimeout);
                    scope.changingName = false;
                    if (scope.object.name === scope.newName) {
                        return;
                    }
                    currentName = scope.object.name;
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

                            scope.object.name = scope.newName;
                            if (scope.type && scope.type === 'image') {
                                Image.renameImage(scope.object, renameFinished);
                            } else {
                                $$track.event('machine', 'rename');
                                Machine.renameMachine(scope.object.id, scope.newName).then(renameFinished, function () {
                                    renameFinished();
                                });
                            }
                        }, function () {
                            scope.object.name = currentName;
                            scope.newName = '';
                        }
                    );
                };
            },

            templateUrl: 'machine/static/partials/rename.html'
        };
    }]);
}(window.JP.getModule('Machine')));
