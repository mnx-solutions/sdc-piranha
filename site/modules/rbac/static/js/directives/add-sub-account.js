'use strict';

(function (ng, app) {
    app.directive('addSubAccount', [
        'localization',
        '$http',
        'util',
        function (localization, $http, util) {

            return {
                restrict: 'A',
                replace: true,
                controller: function($scope) {
                    localization.bind('user', $scope);
                },
                link: function ($scope) {
                    $scope.error = null;

                    $scope.countries = $http.get('account/countries');

                    $scope.isError = function (field, errorType) {
                        var form = $scope.subAccountForm;
                        form.submitted = $scope.formSubmitted;
                        return util.isFormInvalid(form, field, errorType);
                    };

                    window.jQuery('.glyphicon.glyphicon-info-sign').tooltip();
                },
                templateUrl: 'rbac/static/partials/add-sub-account.html'
            };
        }]);
}(window.angular, window.JP.getModule('rbac')));