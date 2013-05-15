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
    $scope.graphs = [];

    $scope.ca = new caBackend();

    $scope.$watch('ca.deletequeue.length', function(newvalue){
        if(newvalue) {
            var id = $scope.ca.deletequeue[0];
            for( var g in $scope.graphs ) {
                var graph = $scope.graphs[g];
                for(var i in graph.instrumentations) {
                    if( graph.instrumentations[i].id == id) {
                        $scope.graphs.splice(g, 1);
                        $scope.ca.deletequeue.splice(0, 1);
                    }
                }

            }
        }
    })

    $scope.ca.describeCa(function (conf){

        $scope.conf = conf;


        $scope.metrics = $scope.conf.metrics;
        $scope.fields = $scope.conf.fields;

        $scope.ca.listAllInstrumentations(function(time, insts) {

            if(!$scope.endtime && time) {

                $scope.endtime = time;
                tick();
            }


            for(var i in insts) {

                $scope.ca.createInstrumentation({
                    init: insts[i],
                    pollingstart: time
                }, function(err, inst) {
                    if(!err) {
                        $scope.graphs.push({
                            instrumentations: [inst],
                            ca: $scope.ca,
                            title: $scope.ca.instrumentations[inst.id].graphtitle
                        });
                    }

                });

            }

        });
//        console.log('ca.instrumentations', ca.instrumentations);
//        $scope.$watch('ca.instrumentations.length', function(){
//            console.log('watching instrumentations');
//            for(var g in $scope.graphs) {
//                var graph = $scope.graphs[g];
//                for(var i in graph.instrumentations) {
//                    var inst = graph.instrumentations[i];
//                    if(!ca.instrumentations[inst.id]){
//                        console.log('deleting', $scope.graphs);
//                        delete($scope.graphs[g]);
//                        console.log($scope.graphs);
//                    }
//                }
//            }
//        });
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

          (function(index) {
              $scope.ca.createInstrumentations(oo[index], function(errs, inst) {
                  if(!errs.length) {
                      if(!$scope.endtime) {
                          // TODO: fix timing issue. Something calculates times incorrectly, this -1 is a temporary fix
                          $scope.endtime = Math.floor(inst[0].crtime / 1000) - 1;
                          tick();
                      }
                      $scope.graphs.push({
                          instrumentations: inst,
                          ca: $scope.ca,
                          title: ot[index]
                      });
                  }
              });
            })(opt);

        }
    }



    $scope.createInstrumentation = function(){

        var decomp = [];
        if($scope.current.decomposition.primary)
        decomp.push($scope.current.decomposition.primary);
        if($scope.current.decomposition.secondary)
        decomp.push($scope.current.decomposition.secondary);
        var mod = $scope.current.metric.module;
//        var predicate = mod === 'zfs' && {} || { "eq": ["zonename", $scope.zoneId ]};
        var predicate = { "eq": ["zonename", $scope.zoneId ]};
        var options = {
            module: mod,
            stat: $scope.current.metric.stat,
            decomposition: decomp,
            predicate: predicate
        }

        $scope.ca.createInstrumentations([ options ], function(errs, instrumentations){
            console.log(instrumentations);

            if(!errs.length) {
                console.log('no errors')
                if(!$scope.endtime) {
                    // TODO: fix timing issue. Something calculates times incorrectly, this -1 is a temporary fix
                    $scope.endtime = Math.floor(instrumentations[0].crtime / 1000) - 1;
                    tick();
                }
                var title = $scope.ca.instrumentations[instrumentations[0].id].graphtitle;
                $scope.graphs.push({
                    instrumentations: instrumentations,
                    ca: $scope.ca,
                    title: title

                });
            } else {

            }
        });

    }

    $scope.deleteAllInstrumentations = function() {
        $scope.graphs = [];

        $scope.ca.deleteAllInstrumentations();
    }

    $scope.changeMetric = function(){
        $scope.current.decomposition.primary = null;
        $scope.current.decomposition.secondary = null;
        $scope.current.decomposition.secondaryF = null;
    }
    $scope.pause = function() {
        $scope.frozen = true;
    }
    $scope.run = function() {
        $scope.frozen = false;
    }
    $scope.zoomIn = function() {
        var index = $scope.ranges.indexOf($scope.currentRange);

        if(index+1 < $scope.ranges.length){
            index++;
            $scope.currentRange = $scope.ranges[index];
        }
    }
    $scope.zoomOut = function() {
        var index = $scope.ranges.indexOf($scope.currentRange);

        if(index-1 >= 0){
            index--;
            $scope.currentRange = $scope.ranges[index];
        }
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