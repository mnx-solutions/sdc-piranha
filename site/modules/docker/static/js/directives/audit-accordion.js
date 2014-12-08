'use strict';

(function (app) {
    app.directive('auditAccordion',  ['Account', 'dockerClone', function (Account, dockerClone) {
        return {
            templateUrl: 'docker/static/partials/audit-accordion.html',
            restrict: 'EA',
            scope: {
                type: '=',
                items: '='
            },
            link: function ($scope) {
                $scope.gridUserConfig = Account.getUserConfig().$child('docker-audit-' + $scope.type);
                $scope.query = '';
                $scope.gridOrder = ['-npDate'];

                $scope.gridProps = [
                    {
                        id: 'name',
                        name: 'Action',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'Params',
                        name: 'Params',
                        sequence: 2,
                        active: true
                    },
                    {
                        id: 'npDate',
                        name: 'Date',
                        sequence: 3,
                        active: true
                    },
                    {
                        id: 'host',
                        name: 'Host ID',
                        sequence: 4,
                        active: false
                    },
                    {
                        id: 'edit',
                        name: 'Result',
                        type: 'button',
                        btn: {
                            getLabel: function (event) {
                                return event.parsedParams && event.parsedParams.error ? 'Error' : 'Ok, clone';
                            },
                            getClass: function (event) {
                                return event.parsedParams && event.parsedParams.error ? 'btn-edit ci effect-orange-button show-on-click' : 'btn-edit ci btn orange';
                            },
                            show: function (event) {
                                return event.parsedParams && (event.name === 'pull' || event.name === 'run' || event.parsedParams.error);
                            },
                            action: function (event) {
                                return event.parsedParams && event.parsedParams.error ? false : dockerClone(event);
                            },
                            getTooltip: function (event) {
                                return event.parsedParams && event.parsedParams.errorMessage ? event.parsedParams.errorMessage : '';
                            }
                        },
                        sequence: 5,
                        active: true
                    }
                ];

                $scope.gridActionButtons = [];
                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = false;

            }
        };
    }]);
}(window.JP.getModule('docker')));
