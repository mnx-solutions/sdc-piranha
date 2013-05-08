'use strict';

(function (app) {

  app.directive('accountInfoEdit',['Account', '$q', function (Account, $q) {

    return {
      restrict: 'A',
      replace: true,
      scope: true,
      link: function ($scope) {
        $scope.updateable = ['email','firstName','lastName','phone', 'companyName'];
        $scope.updateable2 = ['address','postalCode','city','state','country'];

        $scope.account = Account.getAccount(true);
        $scope.setAccount = function() {
          $scope.account = Account.getAccount(true);
        }

        $scope.error = null;

        $scope.saving = false;

        $scope.updateAccount = function () {
          for(var field in $scope.updateable) {
            if(!$scope.account.$$v[$scope.updateable[field]]) {
              $scope.error = 'Please fill all the required fields';
              return;
            }
          }


          $scope.saving = true;
          console.log($scope.account);
          Account.updateAccount($scope.account).then(function (newAccount) {

            $scope.setAccount();
            $scope.saving = false;
            $scope.error = null;

            $scope.nextStep();
          }, function (err) {
            $scope.error = null;
            $scope.saving = false;
          });

        };
      },
      templateUrl: 'account/static/partials/account-info-edit.html'
    };
  }]);
}(window.JP.getModule('Account')));