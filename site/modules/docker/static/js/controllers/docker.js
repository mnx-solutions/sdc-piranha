'use strict';

(function (app) {
    app.controller('Docker.IndexController', [
        '$scope',
        '$rootScope',
        '$q',
        '$qe',
        'requestContext',
        'localization',
        '$location',
        'Datacenter',
        'Image',
        'Machine',
        'PopupDialog',

        function ($scope, $rootScope, $q, $qe, requestContext, localization, $location, Datacenter, Image, Machine, PopupDialog) {
            localization.bind('docker.index', $scope);
            requestContext.setUpRenderContext('docker.index', $scope, {
                title: localization.translate(null, 'docker', 'See my Joyent Docker Instances')
            });

            var image = ''; // TODO Ubuntu Image
            $scope.data = {};
            $scope.data.datacenter = 'local-u';

            $scope.selectDatacenter = function (name) {
                var datacenters = $scope.datacenters;
                var datacenterName = null;
                if (datacenters.length > 0) {
                    var hasSpecifiedDatacenter = datacenters.some(function (datacenter) {
                        return datacenter.name === name;
                    });
                    if (name && hasSpecifiedDatacenter) {
                        datacenterName = name;
                    } else {
                        datacenterName = datacenters[0].name;
                    }
                }
                if (datacenterName) {
                    $scope.data.datacenter = datacenterName;
                    $rootScope.commonConfig('datacenter', datacenterName);
                }
            };

            var tasks =[
                $q.when(Datacenter.datacenter()),
            ];

            $qe.every(tasks).then(function (result) {
                $scope.datacenters = result[0];
            }, function (err) {
                PopupDialog.errorObj(err);
            });

            $scope.createDocker = function () {
                $location.path('/compute/create/' + image);
            };
        }
    ]);
}(window.JP.getModule('docker')));
