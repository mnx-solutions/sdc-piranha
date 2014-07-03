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
                $scope.loading = false;
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
                        var regexp = /(Parse\s*error\s*on\s*line\s*\d+\s*:\s*(.+)\n[\-]+[^\n]+\n.*\'),?/g; //expected message = "Parse error on line 1:\n*can createmachine*\n-----^\nExpecting 'CAN', got 'FUZZY_STRING'"
                        while ((match = regexp.exec(err.message)) !== null) {
                            var ruleError = match[2];
                            $scope.rules.forEach(function (rule, index) {
                                if (ruleError === rule.rule.substring(0, 25)) {
                                    ruleErrors.push({index: index + 1, message: match[1]});
                                }
                            });
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

            function isFormInvalid() {
                return $scope.policyForm.$invalid;
            }

            $scope.createPolicy = function () {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                convertRules();
                $scope.model.policy.name = $scope.model.policy.dirtyName;
                $scope.model.policy.description = $scope.model.policy.dirtyDescription;
                policyAction(service.createPolicy($scope.model.policy), true);
            };

            //FIXME: Get rid of 'redirect' properties if we store rules only with policy
            $scope.updatePolicy = function (redirect) {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                convertRules();
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
                    $scope.model.newRule = '';
                }
            };

            $scope.saveRule = function (rule, index) {
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