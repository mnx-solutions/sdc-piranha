'use strict';

(function (app) {
    app.directive('auditAccordion',  ['dockerClone', function (dockerClone) {
        return {
            templateUrl: 'docker/static/partials/audit-accordion.html',
            restrict: 'EA',
            scope: {
                type: '=',
                items: '='
            },
            link: function ($scope) {
                $scope.query = '';
                $scope.gridOrder = ['-npDate'];

                $scope.gridProps = [
                    {
                        id: 'name',
                        name: 'Name',
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
                        name: 'Host Id',
                        sequence: 4,
                        active: false
                    },
                    {
                        id: 'edit',
                        name: 'Action',
                        type: 'button',
                        hideSorter: true,
                        btn: {
                            label: 'Clone',
                            getClass: function () {
                                return 'btn-edit ci effect-orange-button';
                            },
                            show: function (event) {
                                return (event.name === 'createImage' || event.name === 'run') && event.Params;
                            },
                            action: function (event) {
                                return dockerClone(event);
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
