'use strict';

(function (ng, app) {
    app.directive('selectTwo', ['Select2overlay',
        function (Select2overlay) {
            return {
                link: function ($scope, $element, $attrs) {
                    var conf = {minimumResultsForSearch: -1};
                    if ($attrs.searchBox) {
                        conf.minimumResultsForSearch = 1;
                    }
                    if ($attrs.width) {
                        conf.width = $attrs.width;
                    }

                    $element.select2(conf).change(function (e) {
                        $scope.$apply(function () {
                            if (!$attrs.fn && $scope.selectData && $scope.selected) {
                                if ($attrs.data) {
                                    $scope.data[$attrs.data] = e.val === 'true' || e.val;
                                }
                                if ($scope.selectData && $attrs.item) {
                                    $scope.selectData[$attrs.item].some(function (action) {
                                        if (action.id === e.val) {
                                            $scope.selected[$attrs.item] = action.text;
                                            return true;
                                        }
                                    });
                                }
                            }
                            if ($attrs.fn) {
                                $scope[$attrs.fn](e.val);
                            }
                        });
                    }).on('open', Select2overlay.openHandler).on('close', Select2overlay.closeHandler).on('opening', function () {this.focus();});

                    if ($attrs.select) {
                        $scope.$watch($attrs.select, function (val) {
                            if (!val) {
                                return;
                            }
                            var element = '#s2id_' + $attrs.id + ' a span';
                            $(element).text(val);
                        });
                    }
                }
            };
        }]);
}(window.angular, window.JP.getModule('Menu')));