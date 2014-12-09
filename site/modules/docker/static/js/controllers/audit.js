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
        'Account',
        function ($scope, Docker, PopupDialog, $q, requestContext, localization, dockerClone, Account) {
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

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = Account.getUserConfig().$child('docker-audit');
            }

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
                    name: 'Action',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'host',
                    name: 'Host ID',
                    sequence: 3,
                    active: false
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
                            event.parsedParams = JSON.parse(details) || {};
                            return details;
                        });
                    }
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
                            return event.parsedParams && event.parsedParams.error ? 'btn-edit ci effect-orange-button show-on-click' : 'btn-edit ci btn btn-original-text orange';
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
            $scope.placeHolderText = 'filter containers';
        }
    ]);
}(window.angular, window.JP.getModule('docker')));
