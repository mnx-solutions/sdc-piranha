'use strict';

(function (app) {
    app.controller(
            'cloudAnalytics.LayoutController',
            ['$scope', 'requestContext', 'caBackend', '$timeout', 'caInstrumentation',

function ($scope, requestContext, caBackend, $timeout, caInstrumentation) {
    requestContext.setUpRenderContext('cloudAnalytics', $scope);
    $scope.counter = 0;
    $scope.current = {
        metric:null,
        decomposition: {
            primary: null,
            secondary: null,
            secondaryF: []
        }
    }
    $scope.instrumentations = [];

//    $scope.g = new caBackend.graph();

    var ca = new caBackend();
//    $scope.conf = [];
    var conf = ca.describeCa();
    conf.$get(function(){
        console.log(conf);
        $scope.conf = conf;
        conf.metrics.forEach(labelMetrics);
        $scope.metrics = conf.metrics;
        $scope.fields = conf.fields;
    });
    function labelMetrics(metric) {
        var fieldsArr = metric.fields;
        var labeledFields = [];
        for(var f in fieldsArr) {
            labeledFields[fieldsArr[f]] = conf.fields[fieldsArr[f]].label;
        }
        metric.fields = labeledFields;
        var moduleName = conf.modules[metric.module].label;
        metric.labelHtml = moduleName + ': ' + metric.label;
        return metric;
    }
//    $scope.conf = conf.$get(function(){
//        console.log(conf);
//        conf.metrics.forEach(labelMetrics);
//        $scope.metrics = conf.metrics;
//        $scope.fields = conf.fields;
//    });

    $scope.createInstrumentation = function(){

        var decomp = [];
        if($scope.current.decomposition.primary)
        decomp.push($scope.current.decomposition.primary);
        if($scope.current.decomposition.secondary)
        decomp.push($scope.current.decomposition.secondary);

        var obj = {
            module: $scope.current.metric.module,
            metric: $scope.current.metric,
            stat: $scope.current.metric.stat,
            decomposition: decomp,
            predicate: {}
        }
        $scope.instrumentations.push(obj);

    }
    $scope.changeMetric = function(){
        $scope.current.decomposition.primary = null;
        $scope.current.decomposition.secondary = null;
        $scope.current.decomposition.secondaryF = null;
    }

    $scope.changeDecomposition = function(){

        if($scope.current.decomposition.primary) {
            var currentType = conf.fields[$scope.current.decomposition.primary].type;
            var currentArity = conf.types[currentType].arity;
            $scope.current.decomposition.secondaryF = [];
            $scope.current.decomposition.secondary = null;
            for(var f in $scope.current.metric.fields){
                var fieldType = conf.fields[f].type;
                var fieldArity = conf.types[fieldType].arity;
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