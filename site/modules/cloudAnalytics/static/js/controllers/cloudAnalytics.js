'use strict';

(function (app) {
    app.controller(
            'cloudController',
            ['$scope', 'caBackend', '$routeParams', 'Machine', '$q', 'caInstrumentation', '$timeout',

function ($scope, caBackend, $routeParams, Machine, $q, instrumentation, $timeout) {
    //requestContext.setUpRenderContext('cloudAnalytics', $scope);
    var zoneId = ($routeParams.machine) ? $routeParams.machine : null;

    $scope.zoneId = zoneId;

    $scope.zones = Machine.machine();

    $scope.ranges = [10, 30, 60, 90, 120];
    $scope.currentRange = 60;

    $scope.endtime = null;
    $scope.frozen = false;

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

        $scope.conf = conf;


        $scope.metrics = $scope.conf.metrics;
        $scope.fields = $scope.conf.fields;

        ca.listAllInstrumentations(function(time, insts) {

            if(!$scope.endtime && time) {

                $scope.endtime = time;
                tick();
            }


            for(var i in insts) {

                ca.createInstrumentation({
                    init: insts[i],
                    pollingstart: time
                }, function(inst) {

                    $scope.instrumentations.push({
                        instrumentations: [inst],
                        ca: ca,
                        title: 'title'
                    });
                });

            }

        })
    });

    $scope.createDefaultInstrumentations = function() {

        /* pre-defined default intrumentations */
        var oo = [
            [{
                module: 'cpu',
                stat: 'usage',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }], [{
                module: 'cpu',
                stat: 'waittime',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }], [{
                module: 'memory',
                stat: 'rss',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            },{
                module: 'memory',
                stat: 'rss_limit',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }], [{
                module: 'memory',
                stat: 'reclaimed_bytes',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }], [{
                module: 'zfs',
                stat: 'dataset_unused_quota',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }, {
                module: 'zfs',
                stat: 'dataset_quota',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }], [{
                module: 'nic',
                stat: 'vnic_bytes',
                decomposition: ['zonename'],
                predicate: { "eq": ["zonename", $scope.zoneId] }
            }]
        ];

        var ot = [
            'CPU: useage',
            'CPU: waittime',
            'Memory: resident set size vs max resident size',
            'Memory: excess memory reclaimed',
            'ZFS: used space vs unused quote',
            'Network: utilization'
        ]

        for(var opt in oo) {
            ca.createInstrumentations(oo[opt], function(inst) {
                if(!$scope.endtime) {
                    // TODO: fix timing issue. Something calculates times incorrectly, this -1 is a temporary fix
                    $scope.endtime = Math.floor(inst[0].crtime / 1000) - 1;
                    tick();
                }
                $scope.instrumentations.push({
                    instrumentations: inst,
                    ca: ca,
                    title: ot[opt]
                });
            });

        }
    }



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

        ca.createInstrumentations([ options ], function(instrumentations){
            if(!$scope.endtime) {
                // TODO: fix timing issue. Something calculates times incorrectly, this -1 is a temporary fix
                $scope.endtime = Math.floor(instrumentations[0].crtime / 1000) - 1;
                tick();
            }
            var title = 'title';
            $scope.instrumentations.push({
                instrumentations: instrumentations,
                ca: ca,
                title: title

            });

        });

    }

    $scope.deleteAllInstrumentations = function() {
        $scope.instrumentations = [];
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

    function tick(){

        $scope.endtime++;

        $timeout(tick, 1000);
    }

}

            ]);
}(window.JP.getModule('cloudAnalytics')));