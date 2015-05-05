'use strict';

(function (ng, app) {
    app.directive('imageIdPopover', [function () {
        return {
            scope: {
                object: '='
            },
            template: '<span data-toggle="popover" id="{{id}}" data-placement="right" data-html="true" data-content="{{content}}" data-ng-bind-html="htmlLink"></span>',

            link: function (scope, element) {
                var IMAGE_PATH = '<a href="#!/docker/image/';
                scope.$watch('object.actionInProgress', function () {
                    scope.htmlLink = '<a style="min-width: 140px;">' + scope.object.ShorId + '</a>';
                    var content = ['<span>This image is on several hosts</span><br/>'];
                    if (scope.object.hostIds) {
                        scope.id = scope.object.ShorId;
                        scope.object.hostIds.forEach(function (hostId, index) {
                            var htmlLink = IMAGE_PATH + hostId + '/' + scope.object.Id + '">' + scope.object.hostNames[index] + '</a><br/>';
                            if (scope.object.isRemoving) {
                                htmlLink = scope.object.hostNames[index] + '<br/>';
                            }
                            content.push(htmlLink);
                        });
                    } else {
                        scope.id = null;
                        scope.htmlLink = IMAGE_PATH + scope.object.hostId + '/' + scope.object.Id + '" style="min-width: 140px;">' + scope.object.ShorId + '</a>';
                        if (scope.object.isRemoving) {
                            scope.htmlLink = scope.object.ShorId;
                        }
                    }

                    scope.content = content.join('');

                    if (scope.id) {
                        element.popover({
                            html : true,
                            trigger : 'hover',
                            placement : 'right',
                            selector: '[data-toggle]',
                            delay: {show: 50, hide: 400}
                        });
                    }
                });
            }

        };
    }]);
}(window.angular, window.JP.getModule('docker')));