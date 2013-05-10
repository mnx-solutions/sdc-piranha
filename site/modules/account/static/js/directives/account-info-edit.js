'use strict';

(function (app) {

  app.directive('accountInfoEdit',
    ['Account', 'localization', '$q', '$http',
      function (Account, localization, $q, $http) {

        return {
          restrict: 'A',
          replace: true,
          scope: true,
          link: function ($scope) {
            function required(fields) {
              for(var field in fields) {
                if (fields[field].required && !$scope.account.$$v[field]) {
                  return false;
                }
              }

              return true;
            }

            function sanitize(fields) {
              for(var field in fields) {
                if (!fields[field].pattern) {
                  fields[field].pattern = new RegExp('/^+$/');
                }
              }
            }

            $scope.countries = null;
            $http.get('billing/countries').success(function (data) {
              $scope.countries = data;
            });

            $scope.allStates = null;
            $http.get('billing/states').success(function (data) {
              $scope.allStates = data;
            });

            $scope.stateSel = null;

            $scope.$watch('account["country"]', function (newVal, oldVal) {
              console.log(newVal, oldVal, $scope.account);
              if(oldVal === 'USA' || oldVal === 'CAN'){
                $scope.account.$$v['state'] = '';
              }
              if(newVal === 'USA') {
                $scope.stateSel = $scope.allStates.us.obj;
              } else if (newVal === 'CAN') {
                $scope.stateSel = $scope.allStates.canada.obj;
              } else {
                $scope.stateSel = undefined;
              }
            }, true);


            $scope.fields = {
              basic: {
                email: {
                  title: localization.translate(null, 'account', 'Email'),
                  type: 'email',
                  shown: true,
                  pattern: new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"),
                  required: true
                },

                firstName: {
                  title: localization.translate(null, 'account', 'First name'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                lastName: {
                  title: localization.translate(null, 'account', 'Last name'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                phone: {
                  title: localization.translate(null, 'account', 'Phone'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(\d+)$/'),
                  required: true
                },

                companyName: {
                  title: localization.translate(null, 'account', 'Company name'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                }
              },

              address: {
                address: {
                  title: localization.translate(null, 'account', 'Address'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                postalCode: {
                  title: localization.translate(null, 'account', 'Postal code'),
                  type: 'number',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                city: {
                  title: localization.translate(null, 'account', 'City'),
                  type: 'text',
                  shown: true,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                state: {
                  title: localization.translate(null, 'account', 'State'),
                  type: 'text',
                  shown: false,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                },

                country: {
                  title: localization.translate(null, 'account', 'Country'),
                  type: 'text',
                  shown: false,
                  pattern: new RegExp('/^(.*)$/'),
                  required: true
                }
              }
            };

            $scope.error = null;
            $scope.saving = false;
            $scope.account = Account.getAccount(true);

            $scope.setAccount = function() {
              $scope.account = Account.getAccount(true);
            };

            $scope.updateAccount = function () {
              if (required($scope.fields.basic) &&
                required($scope.fields.address)) {
                $scope.saving = true;

                Account.updateAccount($scope.account).then(function () {
                  $scope.saving = false;
                  $scope.error = null;

                  if ($scope.nextStep) {
                    $scope.setAccount();
                    $scope.nextStep();
                  }
                }, function (err) {
                  $scope.error = null;
                  $scope.saving = false;
                });
              } else {
                $scope.error = localization.translate(null, 'account', 'Please fill all the required fields');
              }
            };
          },
          templateUrl: 'account/static/partials/account-info-edit.html'
        };
      }]);
}(window.JP.getModule('Account')));