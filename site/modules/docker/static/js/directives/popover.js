'use strict';

(function (ng, app) {
    app.directive('imageIdPopover', ['$timeout', function ($timeout) {
        return {
            scope: {
                object: '='
            },
            template: '<span data-toggle="popover" id="{{id}}" data-placement="right" data-html="true" data-content="{{content}}"><a href="{{link}}" style="min-width: 140px;">{{object.ShorId}}</a></span>',

            link: function (scope, element) {

                var content = ['<span>This image is on several hosts</span><br/>'];
                if (scope.object.hostIds) {
                    scope.id = scope.object.ShorId;
                    scope.object.hostIds.forEach(function (hostId, index) {
                        content.push('<a href="#!/docker/image/' + hostId + '/' + scope.object.Id + '">' + scope.object.hostNames[index] + '</a><br/>');
                    });
                } else {
                    scope.id = null;
                    scope.link = '#!/docker/image/' + scope.object.hostId + '/' + scope.object.Id;
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

                    $timeout(function () {
                        $('#' + scope.id).find('a').removeAttr("href");
                    }, 500);
                }
            }

        };
    }]);
}(window.angular, window.JP.getModule('docker')));