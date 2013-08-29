'use strict';

(function (ng, app) {
    app.controller('Machine.ImagesController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Image',
        'localization',
        'util',
        '$http',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Image, localization, util, $http) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images', $scope, {
                title: localization.translate(null, 'machine', 'Image List')
            });

            $scope.imagePromise = Image.image(true);
            $scope.loading = true;
            $scope.images = [];

            $q.when($scope.imagePromise).then(
                function (data) {
                    // TODO: images promise logic should be like machines
                    //console.log('refresh');
                    //console.log(data);
                    $scope.images = [];
                    $scope.images.push.apply($scope.images, data);
                    $scope.search();
                    $scope.loading = false;
                }
            );

            // Sorting
            $scope.sortingOrder = null;
            $scope.reverse = true;

            $scope.sortable = [
                { title: 'Name', value: 'name' },
                { title: 'Description', value: 'description' },
                { title: 'Version', value: 'version' }
            ];
            $scope.sortField = $scope.sortable[0];

            $scope.loading = true;

            // Pagination
            $scope.itemsPerPage = 15;
            $scope.pagedImages = [];
            $scope.showAllActive = false;
            $scope.collapsedImages = {};
            $scope.maxPages = 5;
            $scope.currentPage = 0;

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.imagePromise = Image.image(true);
                }
            );

            // Searching
            $scope.searchOptions = {
                All: [
                    'description', 'id', 'name',
                    'type', 'os', 'published_at',
                    'requirements', 'version'
                ],
                Visible: [
                    'description', 'id', 'name',
                    'version', 'os', 'published_at'
                ],
                Name: ['id', 'name'],
                Type: ['type']
            };

            $scope.searchable = $scope.searchOptions.Visible;
            $scope.filteredImages = [];

            var _filter = function (subject) {
                var searchMatch = function (haystack, needle) {
                    if (!needle) {
                        return true;
                    }
                    var helper = haystack;
                    if (ng.isNumber(haystack)) {
                        helper = haystack.toString();
                    }
                    var subject = helper.toLowerCase();

                    return (subject.indexOf(needle.toLowerCase()) !== -1);
                };

                var ret = $filter('filter')(subject, function (item) {
                    var attrKey;
                    for (attrKey in item) {
                        var attr = item[attrKey];
                        if ($scope.searchable.indexOf(attrKey) === -1) {
                            continue;
                        }

                        // handle up to 2 dimensional searching
                        if (ng.isObject(attr) || ng.isArray(attr)) {
                            var child;
                            for (child in attr) {
                                if (ng.isString(attr[child]) || ng.isNumber(attr[child])) {
                                    if (searchMatch(attr[child], $scope.query)) {
                                        return true;
                                    }
                                }
                            }

                        } else if (ng.isString(attr) || ng.isNumber(attr)) {
                            if (searchMatch(attr, $scope.query)) {
                                return true;
                            }
                        }
                    }

                    return (false);
                });
                return ret;
            };

            // Controller methods
            // Sorting
            // change sorting order
            var __fieldName;
            $scope.sortBy = function (fieldName, changeDirection) {
                $scope.reverse = __fieldName === fieldName ? !$scope.reverse : false;
                __fieldName = fieldName;

                // Assume that filter method will find least one matching item
                try {
                    $scope.sortField = $scope.sortable.filter(function (item) {
                        return fieldName === item.value;
                    })[0];

                    $cookieStore.put('imageSortField', fieldName);
                    $cookieStore.put('imageSortDirection', $scope.reverse);
                } catch (e) {
                    // Cannot change sorting field, ignore
                    return;
                }

                var oldFieldName = $scope.sortingOrder;
                $scope.sortingOrder = fieldName;
                $scope.search((oldFieldName != fieldName));

                // OLD stuff
                $scope.sortIcon = {};
                $scope.sortIcon[fieldName] = $scope.reverse ? 'down' : 'up';
            };

            $scope.loading = true;

            // Searching
            $scope.search = function (changePage) {
                // filter by search term
                var oldImageCount = $scope.filteredImages.length;
                $scope.filteredImages = _filter($scope.images);
                // take care of the sorting order
                if ($scope.sortingOrder !== '') {
                    $scope.filteredImages = $filter('orderBy')(
                        $scope.filteredImages,
                        $scope.sortingOrder,
                        $scope.reverse);
                }

                if (changePage || oldImageCount != $scope.filteredImages.length) {
                    $scope.currentPage = 0;
                }

                $scope.groupToPages();
                $scope.$watch('images.final', function(newval) {
                    if (newval && $scope.loading) {
                        $scope.loading = false;
                    }
                })
            };

            // Pagination
            // calculate page in place
            $scope.groupToPages = function () {
                $scope.pagedImages = [];

                var i;
                for (i = 0; i < $scope.filteredImages.length; i++) {
                    var index = Math.floor(i / $scope.itemsPerPage);
                    if (i % $scope.itemsPerPage === 0) {
                        $scope.pagedImages[index] = [$scope.filteredImages[i]];
                    } else {
                        $scope.pagedImages[index].push($scope.filteredImages[i]);
                    }
                }
            };

            // get pagination range
            $scope.range = function () {
                var ret = [];

                var start = $scope.currentPage - Math.floor($scope.maxPages / 2);
                var end = $scope.currentPage + Math.ceil($scope.maxPages / 2);

                if (end > $scope.pagedImages.length) {
                    end = $scope.pagedImages.length;
                    if (end - $scope.maxPages >= 0) {
                        start = end - $scope.maxPages;
                    }
                }
                if (start < 0) {
                    start = 0;
                    if (start + $scope.maxPages <= $scope.pagedImages.length) {
                        end = start + $scope.maxPages;
                    }
                }
                var i;

                // add first page
                ret.push(0);
                for (i = start; i < end; i++) {
                    // don't duplicate first or last page
                    if(i != 0 && i != $scope.pagedImages.length-1)
                        ret.push(i);
                }

                // add last page
                if($scope.pagedImages.length > 1)
                    ret.push($scope.pagedImages.length-1);

                return ret;
            };


            // put all images to one page
            $scope.showAll = function() {
                $scope.itemsPerPage = 9999;
                $scope.maxPages = 1;
                $scope.currentPage = 0;
                $scope.showAllActive = true;
                $scope.groupToPages();
            };

            $scope.showPages = function() {
                $scope.itemsPerPage = 15;
                $scope.maxPages = 5;
                $scope.currentPage = 0;
                $scope.showAllActive = false;
                $scope.groupToPages();
            };

            /* export current images */
            $scope.exportDetails = function() {
                var order = [];
                var ignoredValues = ['$$hashKey'];
                var exportData = $scope.images;

                if($scope.images[0]) {
                    Object.keys($scope.images[0]).forEach(function(key) {
                        // if it's not an ignored field
                        if(ignoredValues.indexOf(key) === -1)
                            order.push(key);
                    });
                }

                // filter out ignored fields
                exportData.forEach(function(el) {
                    ignoredValues.forEach(function(e) {
                        delete el[e];
                    });
                });

                $http.post('machine/export', {data: exportData, order: order})
                    .success(function (id) {
                        $scope.exportIframe = '<iframe src="machine/export/' + id + '/csv/image"></iframe>';
                    })
                    .error(function () {
                        console.log('err', arguments);
                    });
            };


            $scope.prevPage = function () {
                if ($scope.currentPage > 0) {
                    $scope.currentPage--;
                }
            };

            $scope.nextPage = function () {
                if ($scope.currentPage < $scope.pagedImages.length - 1) {
                    $scope.currentPage++;
                }
            };

            $scope.setPage = function () {
                $scope.currentPage = this.n;
            };


            if (!$scope.sortingOrder) {
                $scope.reverse = $cookieStore.get('imageSortDirection') || false;
                $scope.sortBy($cookieStore.get('imageSortField') || $scope.sortField.value, false);
            }

            $scope.toggleImage = function (id) {
                if ($scope.isCollapsed(id)) {
                    $scope.collapsedImages[id] = false;
                } else {
                    $scope.collapsedImages[id] = true;
                }
            };

            $scope.isCollapsed = function (id) {
                return !$scope.collapsedImages.hasOwnProperty(id) ||
                    $scope.collapsedImages[id];
            };
            $scope.clickDelete = function (image) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete image'
                    ),
                    localization.translate(
                        $scope,
                        'machine',
                        'Are you sure you want to delete this image'
                    ), function () {
                        $$track.event('image', 'delete');
                        Image.deleteImage(image);
                    });
            };
        }
    ])
}(window.angular, window.JP.getModule('Machine')));
