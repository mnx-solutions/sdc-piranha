'use strict';

(function (app) {
    app.controller(
            'cloudAnalytics.LayoutController',
            ['$scope', 'requestContext', 'caBackend',

function ($scope, requestContext, caBackend) {
    requestContext.setUpRenderContext('cloudAnalytics', $scope);

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
        $scope.conf.metrics.forEach(_labelMetrics);
        $scope.metrics = $scope.conf.metrics;
        $scope.fields = $scope.conf.fields;
    });

    function _labelMetrics(metric) {
        var fieldsArr = metric.fields;
        var labeledFields = [];
        for(var f in fieldsArr) {
            labeledFields[fieldsArr[f]] = $scope.conf.fields[fieldsArr[f]].label;
        }
        metric.fields = labeledFields;
        var moduleName = $scope.conf.modules[metric.module].label;
        metric.labelHtml = moduleName + ': ' + metric.label;
        return metric;
    }

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

        $scope.instrumentations.push({
            options:[ options ],
            ca: ca
        });

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