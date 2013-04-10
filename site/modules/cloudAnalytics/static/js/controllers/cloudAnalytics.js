'use strict';

(function (app) {
    app.controller(
            'cloudController',
            ['$scope', 'caBackend',

function ($scope, caBackend) {
    //requestContext.setUpRenderContext('cloudAnalytics', $scope);
    console.log('ca');

    /* pre-defined default intrumentations */
    var oo = [
        [{
            module: 'cpu',
            stat: 'usage',
            decomposition: [],
            predicate: {}
        }], [{
            module: 'cpu',
            stat: 'waittime',
            decomposition: [],
            predicate: {}
        }], [{
            module: 'memory',
            stat: 'rss',
            decomposition: [],
            predicate: {}
        },{
            module: 'memory',
            stat: 'rss_limit',
            decomposition: [],
            predicate: {}
        }], [{
            module: 'memory',
            stat: 'reclaimed_bytes',
            decomposition: [],
            predicate: {}
        }], [{
            module: 'zfs',
            stat: 'dataset_unused_quota',
            decomposition: [],
            predicate: {}
        }, {
            module: 'zfs',
            stat: 'dataset_quota',
            decomposition: [],
            predicate: {}
        }], [{
            module: 'nic',
            stat: 'vnic_bytes',
            decomposition: ['zonename'],
            predicate: {}
        }]
    ];

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

        $scope.defaultInstrumentations = [];

        for(var opt in oo) {
            $scope.defaultInstrumentations.push({
                options:oo[opt],
                ca:ca
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
            metric: $scope.current.metric,
            stat: $scope.current.metric.stat,
            decomposition: decomp,
            predicate: {}
        }

        $scope.instrumentations.push(
            {
                options:[ options ],
                ca: ca
            }
        );

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