'use strict';

(function (app) {
// app.directive('mainMenu', ['$timeout', 'Menu', function ($timeout, Menu) {
    app.directive('debugWindow', ['Events', 'Jobs', function (Events, Jobs) {
            return {
                link: function ($scope) {
                    $scope.jobs = Jobs.getJobs();
                },
                controller: function ($scope, requestContext) {
                    /*Events.
                    $scope.$on('requestContextChanged', function () {
                        $scope.mainMenu.forEach(function (item) {
                            item.active = requestContext.startsWith(item.link);
                        });
                    });*/
                },
                template: '<div class="debug"><div class="pull-left"><h3>Jobs</h3><div class="jobs">' +
                        '<ul>' +
                        '<li data-ng-repeat="job in jobs" data-ng-class="{running: !job.isFinished, failed:job.isFailed}">' +
                        '<span class="name">{{job.name}}</span>' +
                        '<span class="result">{{job.result}}</span>' +
                        '</li>' +
                        '</ul></div></div>' +
                    '<div class="events pull-right">' +
                    '<h3>Events</h3>'+
                    '<ul>' +
                    '<li data-ng-repeat="job in jobs" data-ng-class="{running: !job.isFinished, failed:job.isFailed}">' +
                        '<span class="name">{{job.name}}</span>' +
                        '<span class="result">{{job.result}}</span>' +
                        '</li>' +
                    '</ul></div>' +
                    '</div>'
            };
        }]);
}(window.JP.getModule('Debug')));