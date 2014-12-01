'use strict';

(function (ng, app) {
    app.controller('Docker.AuditController', [
        '$scope',
        'Docker',
        'PopupDialog',
        '$q',
        'requestContext',
        'localization',
        'dockerClone',
        function ($scope, Docker, PopupDialog, $q, requestContext, localization, dockerClone) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.audit', $scope, {
                title: localization.translate(null, 'docker', 'Docker Audit')
            });

            $scope.loading = true;

            Docker.getAuditInfo().then(function(info) {
                $scope.audit = info || [];
                $scope.loading = false;
            });

            var getEntryAuditDetails = function (event) {
                if (!event.params) {
                    event.params = Docker.getAuditDetails({event: event});
                }
                return event.params;
            };


            $scope.query = '';
            $scope.gridOrder = ['-npDate'];

            $scope.gridProps = [
                {
                    id: 'type',
                    name: 'Type',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'host',
                    name: 'Host Id',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'npDate',
                    name: 'Date',
                    sequence: 4,
                    active: true
                },
                {
                    id: 'params',
                    name: 'Params',
                    sequence: 4,
                    active: false,
                    type: 'async',
                    hideSorter: true,
                    _getter: function (event) {
                        return getEntryAuditDetails(event).then(function (details) {
                            return details;
                        });
                    }
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
            $scope.placeHolderText = 'filter containers';
        }
    ]);
}(window.angular, window.JP.getModule('docker')));
