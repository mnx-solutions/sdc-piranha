'use strict';

(function (ng, app) {
    app.controller(
        'SignupController',
        ['$scope', 'requestContext', 'navigation',

function ($scope, requestContext, navigation) {
    requestContext.setUpRenderContext('signup.index', $scope);

    // Build navigation stack
    navigation.add({
        id: 'step-1',
        name: 'Create Account',
        partial: 'static/partial/steps/step-index.html'
    });

    navigation.add({
        id: 'step-2',
        name: 'Phone Verification',
        partial: 'static/partial/steps/step-verification.html'
    });

    navigation.add({
        id: 'step-3',
        name: 'Payment Method',
        partial: 'static/partial/steps/step-payment.html'
    });

    navigation.add({
        id: 'step-4',
        name: 'SSH Keys',
        partial: 'static/partial/steps/step-keys.html'
    });

    navigation.item(3).state = navigation.STATES.INPROGRESS;
    navigation.item(3).selected = true;

    $scope.navigation = navigation;

    /**
     * Controller public methods
     */

    $scope.navigateToStep = function (step) {
        navigation.selectItemAtIndex(step);
    };

    $scope.pageLoaded = function () {
        ng.element('.-help').bind({
            mouseover: function () {
                $(this).tooltip('show');
            },
            mouseout: function () {
                $(this).tooltip('hide');
            }
        });
    };

    /**
     * Events
     */

// $scope.$on('step:success', function (scope, item) {
    $scope.$on('step:success', function () {
        // Proceed to the next step
        navigation.selectedItem.state = navigation.STATES.COMPLETE;
        navigation.selectNextItem();
        navigation.selectedItem.state = navigation.STATES.INPROGRESS;
    });

// $scope.$on('step:error', function (scope, err, item) {
    $scope.$on('step:error', function () {
        window.console.log('error');
        window.console.log(arguments);
    });
}

        ]);

}(window.angular, window.JP.getModule('Signup')));