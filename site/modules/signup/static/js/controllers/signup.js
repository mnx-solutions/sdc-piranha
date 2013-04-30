'use strict';

(function (ng, app) {
    app.controller(
        'SignupController',
        ['$scope', 'requestContext',

function ($scope, requestContext) {
    requestContext.setUpRenderContext('signup.index', $scope);

    console.log('here');

    $scope.steps = [
        'billing',
        'ssh'
    ];
    $scope.step = 'billing';


    /**
     * Controller public methods
     */

//    $scope.pageLoaded = function () {
//        ng.element('.-help').bind({
//            mouseover: function () {
//                $(this).tooltip('show');
//            },
//            mouseout: function () {
//                $(this).tooltip('hide');
//            }
//        });
//    };

    /**
     * Events
     */

// $scope.$on('step:success', function (scope, item) {
//    $scope.$on('step:success', function () {
        // Proceed to the next step
//        navigation.selectedItem.state = navigation.STATES.COMPLETE;
//        navigation.selectNextItem();
//        navigation.selectedItem.state = navigation.STATES.INPROGRESS;
//    });

// $scope.$on('step:error', function (scope, err, item) {
//    $scope.$on('step:error', function () {
//        window.console.log('error');
//        window.console.log(arguments);
//    });
}

        ]);

}(window.angular, window.JP.getModule('Signup')));