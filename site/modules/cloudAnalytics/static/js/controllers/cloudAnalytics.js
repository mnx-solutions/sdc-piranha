'use strict';

(function (app) {
    app.controller(
            'cloudController',
            ['$scope', 'caBackend', '$routeParams', 'Machine', '$q',

function ($scope, caBackend, $routeParams, Machine, $q) {
    //requestContext.setUpRenderContext('cloudAnalytics', $scope);
    var zoneId = ($routeParams.machine) ? $routeParams.machine : null;

    $scope.zoneId = zoneId;

    $scope.zones = Machine.machine();

    $scope.$watch('zones.final', function(zone) {
        console.log($scope.zones);
    })

    /* pre-defined default intrumentations */
    var oo = [
        [{
            module: 'nic',
            stat: 'vnic_bytes',
            decomposition: ['zonename'],
            predicate: { "eq": ["zonename", $scope.zoneId ]}
        }]
    ];

    var ot = [
        'Network: utilization'
    ]

    $scope.current = {
        metric:null,
        decomposition: {
            primary: null,
            secondary: null,
            secondaryF: []
        }
    }
    $scope.instrumentations = [];

    var ca = new caBackend();
    ca.describeCa(function (conf){

        $scope.hostInstrumentations = [];
        $scope.zoneInstrumentations = [];

        for(var opt in oo) {
            if($scope.zoneId) {
                oo[opt].predicate = { "eq": ["zonename", $scope.zoneId] }
            }
            $scope.hostInstrumentations.push({
                options:oo[opt],
                ca:ca,
                title: ot[opt]
            })
        }

        $scope.conf = conf;


        $scope.metrics = $scope.conf.metrics;
        $scope.fields = $scope.conf.fields;
    });



    $scope.createInstrumentation = function(){

        var decomp = [];
        if($scope.current.decomposition.primary)
        decomp.push($scope.current.decomposition.primary);
        if($scope.current.decomposition.secondary)
        decomp.push($scope.current.decomposition.secondary);

        var options = {
            module: $scope.current.metric.module,
            stat: $scope.current.metric.stat,
            decomposition: decomp,
            predicate: { "eq": ["zonename", $scope.zoneId ]}
        }

        $scope.instrumentations.push(
            {
                options:[ options ],
                ca: ca//,
//                title: 'proov'
            }
        );

    }

    $scope.deleteAllInstrumentations = function() {
        ca.deleteAllInstrumentations();
    }

    $scope.changeMetric = function(){
        $scope.current.decomposition.primary = null;
        $scope.current.decomposition.secondary = null;
        $scope.current.decomposition.secondaryF = null;
    }

    $scope.changeDecomposition = function(){

        if($scope.current.decomposition.primary) {
            var currentType =$scope.conf.fields[$scope.current.decomposition.primary].type;
            var currentArity =$scope.conf.types[currentType].arity;
            $scope.current.decomposition.secondaryF = [];
            $scope.current.decomposition.secondary = null;
            for(var f in $scope.current.metric.fields){
                var fieldType =$scope.conf.fields[f].type;
                var fieldArity =$scope.conf.types[fieldType].arity;
                if( fieldArity !== currentArity) {
                    $scope.current.decomposition.secondaryF[f] = $scope.current.metric.fields[f];
                }

            }
        } else {
            $scope.current.decomposition.secondaryF = [];
            $scope.current.decomposition.secondary = null;
        }

    }

}

            ]);
}(window.JP.getModule('cloudAnalytics')));