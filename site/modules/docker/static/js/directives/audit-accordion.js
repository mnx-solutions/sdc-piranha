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
                        id: 'hostName',
                        name: 'Host',
                        sequence: 4,
                        active: true,
                        type: 'html',
                        _getter: function (event) {
                            return '<a href="#!/compute/instance/' + event.host + '" style="min-width: 140px;">' + event.hostName + '</a>';
                        }
                    },
                    {
                        id: 'host',
                        name: 'Host ID',
                        sequence: 5,
                        active: false
                    },
                    {
                        id: 'edit',
                        name: 'Result',
                        type: 'button',
                        btn: {
                            getLabel: function (event) {
                                return event.parsedParams && event.parsedParams.error ? 'Error' : 'Clone';
                            },
                            getClass: function (event) {
                                return 'btn-edit ci btn-audit ' + (event.parsedParams && event.parsedParams.error ? 'effect-orange-button show-on-click' : 'btn btn-original-text orange');
                            },
                            show: function (event) {
                                return event.parsedParams && (event.action || event.parsedParams.error);
                            },
                            action: function (event) {
                                return event.parsedParams && event.parsedParams.error ? false : dockerClone(event);
                            },
                            getTooltip: function (event) {
                                return event.parsedParams && event.parsedParams.errorMessage ? event.parsedParams.errorMessage : '';
                            }
                        },
                        sequence: 6,
                        active: true
                    }
                ];

                $scope.gridActionButtons = [];
                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = false;
                $scope.tabFilterField = 'action';
            }
        };
    }]);
}(window.JP.getModule('docker')));
