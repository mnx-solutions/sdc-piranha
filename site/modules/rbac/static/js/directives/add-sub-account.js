'use strict';

(function (ng, app) {
    app.directive('addSubAccount', [
        'localization',
        '$http',
        function (localization, $http) {

            return {
                restrict: 'A',
                replace: true,
                controller: function($scope) {
                    localization.bind('user', $scope);
                },
                link: function ($scope) {
                    $scope.error = null;

                    $scope.countries = $http.get('billing/countries');

                    $scope.isError = function (field, errorType) {
                        var isPresent = false;
                        if ($scope.subAccountForm[field].$dirty) {
                            Object.keys($scope.subAccountForm[field].$error).some(function (key) {
                                if ($scope.subAccountForm[field].$error[key] && (!errorType || key === errorType)) {
                                    isPresent = true;
                                    return true;
                                }
                                return false;
                            });
                        }

                        return isPresent;
                    };

                    window.jQuery('.glyphicon.glyphicon-info-sign').tooltip();
                },
                templateUrl: 'rbac/static/partials/add-sub-account.html'
            };
        }]);
}(window.angular, window.JP.getModule('rbac')));