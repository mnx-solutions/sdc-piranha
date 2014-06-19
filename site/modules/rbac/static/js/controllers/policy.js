'use strict';

(function (app) {
    app.controller('rbac.PolicyController', [
        '$q',
        '$scope',
        'Account',
        'rbac.Service',
        'PopupDialog',
        '$location',
        'requestContext',
        'localization',
        function ($q, $scope, Account, service, PopupDialog, $location, requestContext, localization) {
            $scope.loading = true;
            //FIXME: I don't see much sense in enclosing "model" property
            $scope.model = {};
            $scope.model.newRule = '';
            $scope.model.policy = {};
            $scope.model.policy.rules = [];
            $scope.rules = [];
            $scope.isFormSubmited = false;

            var policyId = requestContext.getParam('id');
            var isNew = policyId && policyId === 'create';
            if (!isNew) {
                $scope.model.policy.id = policyId;
                //FIXME: $q.all not needed for one promise
                $q.all([
                    $q.when(service.getPolicy(policyId))
                ]).then(function (result) {
                    var policy = result[0];
                    $scope.model.policy.name = policy.name;
                    policy.rules.forEach(function (res) {
                        $scope.rules.push({rule: res, edit: false});
                    });
                    $scope.loading = false;

                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            } else {
                $scope.loading = false;
            }

            $scope.cancel = function () {
                $location.path('/accounts/policies');
            };


            var policyAction = function (action, redirect) {
                $scope.loading = true;
                //FIXME: data parameter is not used
                action.then(function (data) {
                    //FIXME: No need in setting this flag before redirect
                    $scope.loading = false;
                    if (redirect) {
                        $location.path('/accounts/policies');
                    }
                }, function (err) {
                    $scope.loading = false;
                    if (err.message.indexOf('Parse error on line') > -1) {
                        var message = err.message.replace(/Parse error on line \d+:\n/, '');
                        var match;
                        var errorMessage = 'Error on:';
                        var ruleErrors = [];
                        var regexp = new RegExp('(.+)\n[\-]+[^\n]+\n', 'g'); //expected message = "Parse error on line 1:\n*can createmachine*\n-----^\nExpecting 'CAN', got 'FUZZY_STRING'"
                        while ((match = regexp.exec(message)) !== null) {
                            var ruleError = match[1];
                            $scope.rules.forEach(function (rule, index) {
                                if (ruleError === rule.rule) {
                                    ruleErrors.push(' "Rule ' + (index + 1) + '"');
                                }
                            });
                        }
                        err.message = errorMessage + ruleErrors.join(', ');
                    }
                    PopupDialog.errorObj(err);
                });
            };

            var convertRules = function () {
                $scope.model.policy.rules = $scope.rules.map(function (rule) {
                    return rule.rule;
                });
            };

            function isFormInvalid() {
                return $scope.policyForm.$invalid;
            }

            $scope.createPolicy = function () {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                convertRules();
                policyAction(service.createPolicy($scope.model.policy), true);
            };

            $scope.updatePolicy = function (redirect) {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                convertRules();
                policyAction(service.updatePolicy($scope.model.policy), redirect);
            };

            $scope.deletePolicy = function () {
                policyAction(service.deletePolicy($scope.model.policy.id), true);
            };

            var checkRuleDuplicate = function (rule, index) {
                var hasDuplicates = $scope.rules.some(function (r, i) {
                    return r.rule === rule && i != index;
                });
                if (hasDuplicates) {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Duplicate rule.'
                        )
                    );
                }
                return hasDuplicates;
            };

            var storeRules = function () {
                $scope.lastSavedRules = angular.copy($scope.rules);
            };

            $scope.addRule = function () {
                var newRule = $scope.model.newRule;
                if (!checkRuleDuplicate(newRule)) {
                    $scope.rules.push({rule: newRule, edit: false});
                    if (!isNew) {
                        $scope.updatePolicy(false);
                    }
                    $scope.model.newRule = '';
                }
            };

            $scope.saveRule = function (rule, index) {
                if (!checkRuleDuplicate(rule.rule, index)) {
                    if (!isNew) {
                        $scope.updatePolicy(false);
                    }
                    rule.edit = false;
                    $scope.rules[index].rule = rule.rule;
                }
                storeRules();
            };

            $scope.removeRule = function (rule) {
                var pos = $scope.rules.indexOf(rule);
                if (pos > -1) {
                    $scope.rules.splice(pos, 1);
                }
                if (!isNew) {
                    $scope.updatePolicy(false);
                }
                storeRules();
            };

            $scope.editRule = function (rule) {
                storeRules();
                $scope.focusOut();
                rule.edit = true;
            };

            $scope.focusOut = function () {
                if (!$scope.lastSavedRules) {
                    return;
                }
                for (var i = 0; i < $scope.lastSavedRules.length; i++) {
                    if ($scope.rules[i].rule !== $scope.lastSavedRules[i].rule) {
                        $scope.rules[i].rule = $scope.lastSavedRules[i].rule;
                    }
                    $scope.rules[i].edit = false;
                }
            };

        }
    ]);
}(window.JP.getModule('rbac')));