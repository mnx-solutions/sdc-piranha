'use strict';

(function (app) {
    app.controller(
        'elb.EditController',
        ['$scope', 'requestContext', 'localization', '$resource', '$location', 'util', function ($scope, requestContext, localization, $resource, $location, util) {
            localization.bind('elb', $scope);
            requestContext.setUpRenderContext('elb.edit', $scope, {
                title: localization.translate(null, 'elb', 'Create/Edit Load Balancer')
            });

            var balancerId = requestContext.getParam('balancerId');
            var resource = $resource('elb/item/:id', {id:'@id'});

            $scope.protocols = ['HTTP', 'HTTPS', 'TCP', 'TCPS'];
            $scope.protocolSelected = $scope.protocols[0];

            $scope.server = resource.get({id: balancerId}, function () {
                $scope.server.protocol = $scope.server.protocol || 'HTTP';
            });
            $scope.hc_delays = ['1','3','5','10'];
            $scope.hc_delaySelected = $scope.hc_delays[2]; //default

            $scope.timeouts = ['1','2','5','10','20'];
            $scope.timeoutSelected = $scope.timeouts[1]; //default

            $scope.server = resource.get({id: balancerId});

            $scope.save = function () {
                $scope.server.toPort = $scope.server.fromPort;
                $scope.server.$save();
                $location.path('/elb/list');
            };

            $scope.deleteLB = function(){
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete Load Balacer'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete?'
                    ), function () {
                        //delete function
                    });
            };
            $scope.protocolSelect = function (name) {
                $scope.server.protocol = name;
                $scope.protocolSelected = name;
            };
            $scope.hc_delaySelect = function (name) {
                $scope.hc_delaySelected = name;
            };
            $scope.timeoutSelect = function (name) {
                $scope.timeoutSelected = name;
            };

        }]);
}(window.JP.getModule('elb')));
