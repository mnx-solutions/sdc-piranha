'use strict';

(function (ng, app) {
    app.directive('coreDump', ['$location', 'loggingService', '$route', 'DTrace', 'PopupDialog', 'localization', 'Account',
        function ($location, loggingService, $route, DTrace, PopupDialog, localization, Account) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                options: '=',
                data: '=?'
            },
            templateUrl: 'dtrace/static/partials/core-dump.html',
            link: function ($scope, element, attrs) {

                function addToUserConfig(configProperty, key, value) {
                    Account.getUserConfig(configProperty, function (config) {
                        config[key] = value;
                        Account.saveUserConfig();
                    });
                }
                
                function redirect(path) {
                    $location.url(path);
                    $location.replace();
                }

                $scope.openInStorage = function () {
                    addToUserConfig('fileman', 'path', $scope.path);
                    redirect('/manta/files');
                }

                $scope.openInMdb = function () {
                    Account.getAccount(true).then(function (account) {
                        addToUserConfig('mdb', 'inputFile', [{filePath: '/' + account.login + $scope.path}]);
                        redirect('/devtools/mdb/create');
                    });
                }

                $scope.$watch('data', function (data) {
                    if (data && data !== 'ping') {
                        $scope.nodeProcess = data.node;
                        $scope.path = data.path.replace('~~', '');
                        $scope.coreDumpCreated = true;
                    }
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));