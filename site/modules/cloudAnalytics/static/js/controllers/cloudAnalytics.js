'use strict';

(function (app, ng) {
    app.controller(
            'cloudController',
            ['$scope', 'ca', '$routeParams', 'Machine', '$q', 'caInstrumentation', '$timeout',

function ($scope, ca, $routeParams, Machine, $q, instrumentation, $timeout) {
    //requestContext.setUpRenderContext('cloudAnalytics', $scope);
    var zoneId = ($routeParams.machine) ? $routeParams.machine : null;

    $scope.zoneId = zoneId;

    $scope.zones = Machine.machine();

    $scope.ranges = [10, 30, 60, 90, 120, 150, 180];

    // values graphs are watching
    $scope.currentRange = 60;
    $scope.endtime = null;
    $scope.frozen = false;
    $scope.ca = new ca();

    $scope.current = {
        metric:null,
        decomposition: {
            primary: null,
            secondary: null,
            secondaryF: []
        }
    }
    $scope.graphs = [];
    $scope.help = null;
    $scope.croppedModule = true;
    $scope.croppedMetric = true;

    $scope.$watch('ca.deletequeue.length', function(newvalue){
        if(newvalue) {
            for(var i in $scope.ca.deletequeue){
                var inst = $scope.ca.deletequeue[i];
                var graphIndex = $scope.graphs.length;
                if(graphIndex) {
                    while(graphIndex--) {
                        var graph = $scope.graphs[graphIndex];
                        for(var i in graph.instrumentations) {
                            if( graph.instrumentations[i].id === inst.id && graph.instrumentations[i]._datacenter === inst._datacenter) {
                                $scope.graphs.splice(graphIndex, 1);
                                $scope.ca.deletequeue.splice(0, 1);
                                $scope.ca.cleanup(inst);
                            }
                        }
                    }
                }
            }

        }
    })

    $scope.ca.describeCa(function (err, conf){
        if(!err) {
            $scope.conf = conf;
            $scope.help = $scope.conf.help;
            $scope.metrics = $scope.conf.metrics;
            $scope.fields = $scope.conf.fields;

            $scope.ca.listAllInstrumentations(function(err, time, insts) {
                if(err) {
                    // TODO: handle errors
                    console.log(err);
                } else {
                    if(!$scope.endtime && time) {

                        $scope.endtime = time;
                        tick();
                    }

                    for(var i in insts) {
                        var inst = insts[i];
                        if(!err) {
                            $scope.graphs.push({
                                instrumentations: [inst],
                                title: $scope.ca.instrumentations[inst._datacenter][inst.id].graphtitle
                            });
                        }

                    }

                }

            });
        }

    });

    $scope.createDefaultInstrumentations = function() {
        var datacenter = null;
        for(var i in $scope.zones) {
            var zone = $scope.zones[i];
            if(zone.id === $scope.zoneId) {
                datacenter = zone.datacenter;
            }
        }
        if(!datacenter) {
            //TODO: error handling;
        }
        /* pre-defined default intrumentations */
        var oo = [
            [{
                module: 'cpu',
                stat: 'usage',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            }], [{
                module: 'cpu',
                stat: 'waittime',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            }], [{
                module: 'memory',
                stat: 'rss',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            },{
                module: 'memory',
                stat: 'rss_limit',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            }], [{
                module: 'memory',
                stat: 'reclaimed_bytes',
                decomposition: [],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            }], [{
                module: 'zfs',
                stat: 'dataset_unused_quota',
                decomposition: [],
                predicate: {},
                datacenter: datacenter
            }, {
                module: 'zfs',
                stat: 'dataset_quota',
                decomposition: [],
                predicate: {},
                datacenter: datacenter
            }], [{
                module: 'nic',
                stat: 'vnic_bytes',
                decomposition: ['zonename'],
                predicate: { "eq": ["zonename", $scope.zoneId] },
                datacenter: datacenter
            }]
        ];

        var ot = [
            'CPU: usage',
            'CPU: wait time',
            'Memory: resident set size vs max resident size',
            'Memory: excess memory reclaimed',
            'ZFS: used space vs unused quota',
            'Network: utilization'
        ]

        for(var opt in oo) {

          (function(index) {
              $scope.ca.createInstrumentations(oo[index], function(errs, inst) {
                  if(!errs.length) {
                      if(!$scope.endtime) {
                          $scope.endtime = Math.floor(inst[0].crtime / 1000) - 1;
                          tick();
                      }
                      $scope.graphs.push({
                          instrumentations: inst,
                          title: ot[index]
                      });
                  }
              });
            })(opt);

        }
    }

    $scope.expandMetric = function() {
        $scope.croppedMetric = !$scope.croppedMetric;
    }
    $scope.expandModule = function() {
        $scope.croppedModule = !$scope.croppedModule;
    }


    $scope.createInstrumentation = function(){

        var decomp = [];
        if($scope.current.decomposition.primary)
        decomp.push($scope.current.decomposition.primary);
        if($scope.current.decomposition.secondary)
        decomp.push($scope.current.decomposition.secondary);
        var mod = $scope.current.metric.module;
        var predicate = mod === 'zfs' && {} || { "eq": ["zonename", $scope.zoneId ]};
        var datacenter = null;
        for(var i in $scope.zones) {
            var zone = $scope.zones[i];
            if(zone.id === $scope.zoneId) {
                datacenter = zone.datacenter;
            }
        }
        if(!datacenter) {
            //TODO: error handling;
        }
        var options = {
            module: mod,
            stat: $scope.current.metric.stat,
            decomposition: decomp,
            predicate: predicate,
            datacenter: datacenter
        }
        $scope.ca.createInstrumentations([ options ], function(errs, instrumentations){

            if(!errs.length) {
                if(!$scope.endtime) {
                    $scope.endtime = Math.floor(instrumentations[0].crtime / 1000) - 1;
                    tick();
                }
                var title = $scope.ca.instrumentations[instrumentations[0]._datacenter][instrumentations[0].id].graphtitle;
                $scope.graphs.push({
                    instrumentations: instrumentations,
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
        $scope.croppedMetric = true;
        $scope.croppedModule = true;
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
    $scope.zoomOut = function() {
        var index = $scope.ranges.indexOf($scope.currentRange);

        if(index+1 < $scope.ranges.length){
            index++;
            $scope.currentRange = $scope.ranges[index];
        }
    }
    $scope.zoomIn = function() {
        var index = $scope.ranges.indexOf($scope.currentRange);

        if(index-1 >= 0){
            index--;
            $scope.currentRange = $scope.ranges[index];
        }
    }
    $scope.changeDecomposition = function(){
        $scope.croppedMetric = true;
        $scope.croppedModule = true;
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
}(window.JP.getModule('cloudAnalytics'), window.angular));