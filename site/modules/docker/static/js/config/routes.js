'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    var dockerResolve = {
        data: function ($rootScope, $location, $q, Docker, Machine, Account) {

            function changePath() {
                if (!$rootScope.dockerHostsAvailable && features.sdcDocker === 'disabled') {
                    $location.path('/dashboard');
                } else if ($rootScope.provisionEnabled && $location.path() === '/docker' &&
                    features.sdcDocker === 'enabled') {
                    $location.path('/docker/containers');
                }
            }

            if ($rootScope.dockerHostsAvailable && $rootScope.provisionEnabled) {
                changePath();
            } else {
                Account.getAccount().then(function (account) {
                    account = account || {};
                    $rootScope.provisionEnabled = account.provisionEnabled || false;
                    changePath();
                }, changePath);
            }
        }
    };
    dockerResolve.data.$inject = ['$rootScope', '$location', '$q', 'Docker', 'Machine', 'Account'];

    var checkProvisionEnabled = function ($rootScope, $location, $q, Docker, Machine, Account) {
        Account.getAccount().then(function (account) {
            if (account.provisionEnabled) {
                $location.path('/compute/container/create');
            } else {
                $location.path('/dashboard');
            }
        }, function () {
            dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
        });
    };

    routeProvider
        .when('/docker', {
            title: 'Docker',
            action: 'docker.containers',
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
            resolve: {
                data: ['$route', '$rootScope', '$location', '$q', 'Docker', 'Machine', 'Account', function ($route, $rootScope, $location, $q, Docker, Machine, Account) {
                    if (!$rootScope.dockerHostsAvailable) {
                        $location.path('/dashboard');
                    }
                    if ($location.path().indexOf('/compute/container/create') === 0) {
                        checkProvisionEnabled($rootScope, $location, $q, Docker, Machine, Account);
                        return;
                    }
                    dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
                }]
            }
        }).when('/docker/container/:hostid/:containerid', {
            title: 'Container Details',
            action: 'docker.details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$rootScope', '$location', '$q', 'Docker', 'Machine', 'Account', function ($route, $rootScope, $location, $q, Docker, Machine, Account) {
                    if (!$route.current.params.containerid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                        return;
                    }
                    dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
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
                data: ['$route', '$rootScope', '$location', '$q', 'Docker', 'Machine', 'Account', function ($route, $rootScope, $location, $q, Docker, Machine, Account) {
                    if (!$route.current.params.imageid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                        return;
                    }
                    dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
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
                            dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
                        }
                    }, function () {
                        dockerResolve.data($rootScope, $location, $q, Docker, Machine, Account);
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
                                dockerResolve.data($rootScope, $location, $q, Docker, Account, Machine);
                            }
                        }, function () {
                            dockerResolve.data($rootScope, $location, $q, Docker, Account, Machine);
                        });
                    });
                }]
            }
        });
}]);
