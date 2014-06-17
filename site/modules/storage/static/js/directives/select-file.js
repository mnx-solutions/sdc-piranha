(function (app) {
    app.directive('selectFile', ['PopupDialog', 'localization', 'Account', 'fileman', function (PopupDialog, localization, Account, fileman) {
        return {
            restrict: 'EA',
            transclude: true,
            scope: {
                objects: '=',
                title: '='
            },
            link: function (scope) {
                scope.objects = Array.isArray(scope.objects) ? scope.objects : [];
                var addFilePathCtrl = function ($scope, dialog) {
                    $scope.$watch('filePath', function (filePath) {
                        Account.getAccount().then(function (account) {
                            $scope.fullFilePath = '/' + account.login + filePath;
                        });
                    });
                    $scope.close = function (form, res) {
                        if (form.$invalid && res !== 'cancel') {
                            return;
                        }
                        if (res === 'cancel') {
                            dialog.close({
                                value: res
                            });
                            return;
                        }
                        dialog.close({
                            value: 'add',
                            filePath: $scope.fullFilePath
                        });
                    };
                    $scope.filePath = '';
                    $scope.title = 'Specify file path';
                    $scope.buttons = [
                        {
                            result: 'cancel',
                            label: 'Cancel',
                            cssClass: 'btn grey-new effect-orange-button',
                            setFocus: false
                        },
                        {
                            result: 'add',
                            label: 'Add',
                            cssClass: 'btn orange',
                            setFocus: true
                        }
                    ];
                };

                function showPopupDialog(level, title, message, callback) {
                    return PopupDialog[level](
                        title ? localization.translate(scope, null, title) : null,
                        message ? localization.translate(scope, null, message) : null,
                        callback
                    );
                }

                function pushUnique(objects, path) {
                    var isUnique = !objects.some(function (e) { return e.filePath === path; });
                    if (isUnique) {
                        objects.push({
                            filePath: path,
                            create_at: new Date()
                        });
                    }
                }

                scope.newFilePath = function () {
                    var opts = {
                        templateUrl: 'storage/static/partials/add.html',
                        openCtrl: addFilePathCtrl
                    };

                    PopupDialog.custom(
                        opts,
                        function (result) {
                            if (result && result.value === 'add') {
                                var filePath = result.filePath;
                                fileman.infoAbsolute(filePath, function (error, info) {
                                    if (error) {
                                        return showPopupDialog('error', 'Error', error);
                                    }
                                    var filePathInfo = info.__read();
                                    if (filePathInfo.extension === 'directory') {
                                        fileman.lsAbsolute(filePath, function (err, ls) {
                                            if (err) {
                                                return showPopupDialog('error', 'Error', err);
                                            }
                                            var files = ls.__read();
                                            files.forEach(function (file) {
                                                if (file.type !== 'directory') {
                                                    var path = file.parent + '/' + file.path;
                                                    pushUnique(scope.objects, path);
                                                }
                                            });
                                            return files;
                                        });
                                    } else {
                                        pushUnique(scope.objects, filePath);
                                    }
                                    return filePath;
                                });
                            }
                        }
                    );
                };
            },

            template: '<button class="btn light effect-orange-button pull-right" data-ng-click="newFilePath()"><i class="plus-icon"></i>{{title}}</button>'
        };
    }]);
}(window.JP.getModule('Storage')));