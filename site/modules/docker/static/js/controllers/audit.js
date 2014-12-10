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

            $q.all([
                Docker.getAuditInfo(),
                Docker.listHosts()
            ]).then(function (result) {
                $scope.audit = result[0] || [];
                $scope.audit.forEach(function (audit) {
                    audit.action = (audit.name === 'run' || audit.name === 'pull') ? 'Key actions' : 'All';
                });
                $scope.hosts = result[1] || [];
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
                    id: 'hostName',
                    name: 'Host',
                    sequence: 3,
                    active: true,
                    type: 'tooltip',
                    _getter: function (event) {
                        var eventHost = $scope.hosts.find(function(host) { return event.host === host.id; });
                        if (eventHost) {
                            return {data: '<a href="#!/compute/instance/' + eventHost.id + '" style="min-width: 140px;">' + eventHost.name || eventHost.id + '</a>'};
                        }
                        return {
                            data: 'Host gone',
                            tooltip: 'The host is no longer accessible because the host has been deleted or access privileges have been removed.'
                        };
                    }
                },
                {
                    id: 'host',
                    name: 'Host ID',
                    sequence: 4,
                    active: false
                },
                {
                    id: 'npDate',
                    name: 'Date',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'params',
                    name: 'Params',
                    sequence: 6,
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
                    sequence: 7,
                    active: true
                }
            ];

            $scope.gridActionButtons = [];
            $scope.exportFields = {
                ignore: []
            };
            $scope.searchForm = true;
            $scope.enabledCheckboxes = false;
            $scope.placeHolderText = 'filter audit';
            $scope.tabFilterField = 'action';
        }
    ]);
}(window.angular, window.JP.getModule('docker')));
