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

                $q.when(service.getPolicy(policyId)).then(function (policy) {
                    $scope.storPolicy = angular.copy(policy);
                    $scope.model.policy.dirtyName = $scope.model.policy.name = policy.name;
                    $scope.model.policy.dirtyDescription = $scope.model.policy.description = policy.description;
                    policy.rules.forEach(function (res) {
                        $scope.rules.push({rule: res, edit: false});
                    });
                    $scope.loading = false;

                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            } else {
                Account.getAccount(true).then(function (account) {
                    if (!account.provisionEnabled) {
                        var submitBillingInfo = {
                            btnTitle: 'Submit and Access Create Policy'
                        };
                        Account.checkProvisioning(submitBillingInfo, null, null, function (isSuccess) {
                            $scope.loading = false;
                            if (isSuccess) {
                                $location.path('/accounts/policy/create');
                            } else {
                                $location.path('/accounts/policies');
                            }
                        }, true);
                    } else {
                        $scope.loading = false;
                    }
                });
            }

            $scope.cancel = function () {
                $location.path('/accounts/policies');
            };


            var policyAction = function (action, redirect) {
                $scope.loading = true;
                action.then(function () {
                    $scope.loading = false;
                    if (redirect) {
                        $location.path('/accounts/policies');
                    }
                }, function (err) {
                    $scope.loading = false;
                    if (err.message.indexOf('Parse error on line') > -1) {
                        var match;
                        var ruleErrors = [];
                        var regexp = /(Parse\s*error\s*on\s*line\s*\d+\s*:\s*(.*)\n[\-]*[^\n]+\n.*\'),?/g; //expected message = "Parse error on line 1:\n*can createmachine*\n-----^\nExpecting 'CAN', got 'FUZZY_STRING'"
                        while ((match = regexp.exec(err.message)) !== null) {
                            ruleErrors.push(match[1]);
                        }
                        var opts = {
                            templateUrl: 'rbac/static/partials/rules-error.html',
                            openCtrl: function ($scope, dialog) {
                                $scope.ruleErrors = ruleErrors;
                                $scope.buttons = [
                                    {
                                        result: 'ok',
                                        label: 'Ok',
                                        cssClass: 'orange',
                                        setFocus: false
                                    }
                                ];
                                $scope.buttonClick = function (res) {
                                    dialog.close(res);
                                };
                            }
                        };
                        PopupDialog.custom(opts);
                    } else {
                        PopupDialog.errorObj(err);
                    }
                });
            };

            var convertRules = function () {
                $scope.model.policy.rules = $scope.rules.map(function (rule) {
                    return rule.rule;
                });
            };

            var noRulesProvided = function () {
                var isEmpty = $scope.model.policy.rules.length === 0;
                if (isEmpty) {
                    PopupDialog.error("Error", "Policy must have at least one rule.");
                }
                return isEmpty;
            };

            var isFormInvalid = function () {
                return $scope.policyForm.$invalid || noRulesProvided();
            };

            $scope.createPolicy = function () {
                $scope.isFormSubmited = true;
                convertRules();
                if (isFormInvalid()) {
                    return;
                }
                $scope.model.policy.name = $scope.model.policy.dirtyName;
                $scope.model.policy.description = $scope.model.policy.dirtyDescription;
                policyAction(service.createPolicy($scope.model.policy), true);
            };

            //FIXME: Get rid of 'redirect' properties if we store rules only with policy
            $scope.updatePolicy = function (redirect) {
                $scope.isFormSubmited = true;
                convertRules();
                if (isFormInvalid()) {
                    return;
                }
                if (!redirect) {
                    $scope.storPolicy.rules = $scope.model.policy.rules;
                    policyAction(service.updatePolicy($scope.storPolicy), redirect);
                } else {
                    $scope.model.policy.name = $scope.model.policy.dirtyName;
                    $scope.model.policy.description = $scope.model.policy.dirtyDescription;
                    policyAction(service.updatePolicy($scope.model.policy), redirect);
                }
            };

            $scope.deletePolicy = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete policy'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete the selected policy?'
                    ),
                    function () {
                        $scope.loading = true;
                        policyAction(service.deletePolicy($scope.model.policy.id), true);
                    }
                );
            };

            var checkRuleDuplicate = function (rule, index) {
                var hasDuplicates = $scope.rules.some(function (r, i) {
                    return r.rule.toLowerCase() === rule.toLowerCase() && i !== index;
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
                var newRule = $scope.model.newRule.toLowerCase();
                if (!checkRuleDuplicate(newRule)) {
                    $scope.rules.push({rule: newRule, edit: false});
                    $scope.model.newRule = '';
                }
            };

            $scope.saveRule = function (rule, index) {
                rule.rule = rule.rule.toLowerCase();
                if (!checkRuleDuplicate(rule.rule, index)) {
                    rule.edit = false;
                    $scope.rules[index].rule = rule.rule;
                }
                storeRules();
            };

            $scope.removeRule = function (rule) {
                if (!isNew && $scope.rules.length === 1) {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Policy must have at least one rule.'
                        )
                    );
                    return;
                }
                var pos = $scope.rules.indexOf(rule);
                if (pos > -1) {
                    $scope.rules.splice(pos, 1);
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