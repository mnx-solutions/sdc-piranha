'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    var dockerResolve = {
        data: function ($rootScope, $location, $q, Docker, Machine, Account) {

            function changePath() {
                if ($location.path().indexOf('/docker') === 0 && $location.path() !== '/docker' && (!$rootScope.provisionEnabled || !$rootScope.dockerHostsAvailable)) {
                    $location.path('/docker');
                }
            }

            if ($rootScope.dockerHostsAvailable) {
                changePath();
            } else {
                $q.all([
                    $q.when(Docker.completedHosts()),
                    $q.when(Machine.machine()),
                    $q.when(Account.getAccount())
                ]).then(function (result) {
                    var hosts = result[0] || [];
                    var machines = result[1] || [];
                    var account = result[2] || {};
                    $rootScope.provisionEnabled = account.provisionEnabled || false;
                    $rootScope.dockerHostsAvailable = hosts.length > 0 || machines.some(function (machine) {
                        return machine.tags && machine.tags['JPC_tag'] === 'DockerHost' &&
                            machine.state !== 'creating';
                    });
                    changePath();
                }, changePath);
            }
        }
    };
    dockerResolve.data.$inject = ['$rootScope', '$location', '$q', 'Docker', 'Machine', 'Account'];

    routeProvider
        .when('/docker', {
            title: 'Docker',
            action: 'docker.index',
            resolve: dockerResolve
        }).when('/docker/intro', {
            title: 'Docker',
            action: 'docker.introduction'
        }).when('/docker/registries', {
            title: 'Registries',
            action: 'docker.registries',
            resolve: dockerResolve
        }).when('/docker/registry/:id', {
            title: 'Registry',
            action: 'docker.registry',
            resolve: dockerResolve
        }).when('/docker/containers', {
            title: 'Containers',
            action: 'docker.containers',
            resolve: dockerResolve
        }).when('/docker/containers/running', {
            title: 'Containers',
            action: 'docker.containers',
            resolve: dockerResolve
        }).when('/docker/container/create/:hostid', {
            title: 'Create Container',
            action: 'docker.create',
            resolve: dockerResolve
        }).when('/compute/container/create', {
            title: 'Create Container',
            action: 'docker.create',
            resolve: dockerResolve
        }).when('/docker/container/:hostid/:containerid', {
            title: 'Container Details',
            action: 'docker.details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$rootScope', '$location', '$q', 'Docker', 'Machine', function ($route, $rootScope, $location, $q, Docker, Machine) {
                    if (!$route.current.params.containerid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                        return;
                    }
                    dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                }]
            }
        }).when('/docker/container/create/:hostid?/:sourceid?', {
            title: 'Create Container',
            action: 'docker.create',
            resolve: dockerResolve
        }).when('/docker/images', {
            title: 'Images',
            action: 'docker.images',
            resolve: dockerResolve
        }).when('/docker/image/create/:hostid?/:sourceid?', {
            title: 'Create Image',
            action: 'docker.create',
            resolve: dockerResolve
        }).when('/docker/image/:hostid/:imageid', {
            title: 'Image Details',
            action: 'docker.image-details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$rootScope', '$location', '$q', 'Docker', 'Machine', function ($route, $rootScope, $location, $q, Docker, Machine) {
                    if (!$route.current.params.imageid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                        return;
                    }
                    dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                }]
            }
        }).when('/docker/logs', {
            title: 'Log Management',
            action: 'docker.logManagement',
            resolve: {
                data: ['$rootScope', '$location', '$q', 'Docker', 'Account', 'Machine', function ($rootScope, $location, $q, Docker, Account, Machine) {
                    $q.all([
                        $q.when(Account.getAccount()),
                        $q.when(Docker.getRemovedContainers())
                    ]).then(function (result) {
                        var account = result[0] || {};
                        var containers = result[1] || [];
                        $rootScope.provisionEnabled = account.provisionEnabled || false;
                        if (!containers.length) {
                            dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                        }
                    }, function () {
                        dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                    });
                }]
            }
        }).when('/docker/analytics/:hostid?/:containerid?', {
            title: 'Analytics',
            action: 'docker.analytics',
            resolve: dockerResolve
        }).when('/docker/audit', {
            title: 'Audit',
            action: 'docker.audit',
            resolve: {
                data: ['$rootScope', '$location', '$q', 'Docker', 'Account', 'Storage', 'Machine', function ($rootScope, $location, $q, Docker, Account, Storage, Machine) {
                    Storage.pingManta(function () {
                        $q.all([
                            $q.when(Account.getAccount()),
                            $q.when(Docker.auditPing())
                        ]).then(function (result) {
                            var account = result[0] || {};
                            var audit = result[1] || [];
                            $rootScope.provisionEnabled = account.provisionEnabled || false;
                            if (!audit.length) {
                                dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                            }
                        }, function () {
                            dockerResolve.data($rootScope, $location, $q, Docker, Machine);
                        });
                    });
                }]
            }
        });
}]);
