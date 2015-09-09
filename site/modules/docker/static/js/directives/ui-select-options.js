'use strict';

(function (ng, app) {
    app.directive('uiSelectOptions', function () {
        return {
            restrict: 'A',
            scope: {
                options: '=?'
            },
            link: function (scope, el) {
                var isInProgress = scope.options.inProgress;
                var createTemplate = function () {
                    return '<div id="pullImage" class="pull-image' +
                            (isInProgress() ? '' : ' image-pull-item') + '">' +
                            (isInProgress() ? 'Pulling image in progress' : 'Pull images...') + '</div>';
                };
                var addElementToDOM = function () {
                    el.find('.ui-select-dropdown').append(createTemplate());
                    if (!isInProgress()) {
                        ng.element('#pullImage').on('click', function () {
                            scope.options.click();
                        });
                    };
                };

                el.on('click', function () {
                    createTemplate();
                    ng.element('#pullImage').remove();
                    setTimeout(function () {
                        addElementToDOM();
                    });
                });
            }
        };
    })
}(window.angular, window.JP.getModule('docker')));
