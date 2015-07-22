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
                    audit.action = (audit.name === 'run' || audit.name === 'pull' || audit.name === 'push') ? 'Key actions' : null;
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

            var findHost = function (el) {
                return $scope.hosts.find(function (host) {
                    return el.host === host.id;
                });
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
                    _order: function (event) {
                        var eventHost = $scope.hosts.find(function (host) { return event.host === host.id; });
                        return eventHost ? (eventHost.name || eventHost.id) : 'Host deleted';
                    },
                    sequence: 3,
                    active: true,
                    type: 'tooltip',
                    _export: function (event) {
                        var eventHost = findHost(event);
                        if (eventHost) {
                            return eventHost.name || eventHost.id;
                        }
                        return 'Host deleted';
                    },
                    _getter: function (event) {
                        var eventHost = findHost(event);
                        if (eventHost) {
                            var hostName = eventHost.name || eventHost.id;
                            return eventHost.isSdc ? {data: hostName} : {data: '<a href="#!/compute/instance/' + eventHost.id + '" style="min-width: 140px;">' + hostName + '</a>'};
                        }
                        return {
                            data: 'Host deleted',
                            tooltip: 'The host is no longer accessible because the host has been deleted or access privileges have been removed.'
                        };
                    }
                },
                {
                    id: 'hostId',
                    name: 'Host ID',
                    sequence: 4,
                    active: false
                },
                {
                    id: 'npDate',
                    name: 'Date',
                    sequence: 5,
                    active: true,
                    type: 'date'
                },
                {
                    id: 'params',
                    name: 'Params',
                    sequence: 6,
                    active: false,
                    type: 'async',
                    hideSorter: true,
                    _export: function (event) {
                        return Docker.getAuditDetails({event: event});
                    },
                    _getter: function (event) {
                        return getEntryAuditDetails(event).then(function (details) {
                            event.parsedParams = details;
                            return details;
                        });
                    }
                },
                {
                    id: 'edit',
                    name: 'Result',
                    type: 'button',
                    _export: function (event) {
                        if (!event.parsedParams) {
                            return getEntryAuditDetails(event).then(function (details) {
                                event.parsedParams = details;
                                return Docker.getAuditButtonLabel(event);
                            });
                        }
                        return Docker.getAuditButtonLabel(event);
                    },
                    btn: {
                        getLabel: Docker.getAuditButtonLabel,
                        getClass: function (event) {
                            return 'btn grey edit ' + (event.parsedParams && event.parsedParams.error ? 'show-on-click' : 'btn-original-text orange');
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
                    _order: Docker.getAuditButtonLabel,
                    sequence: 0,
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
