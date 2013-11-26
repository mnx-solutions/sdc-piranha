'use strict';

(function (ng, app) {
    app.factory('Image', [
        'serverTab',
        '$q',
        'localization',
        'util',
        'errorContext',
        '$rootScope',
        function (serverTab, $q, localization, util, errorContext, $rootScope) {

            var service = {};
            var images = {index: {}, job: {}, list: [], search: {}};

            service.updateImages = function (force, showPublic) {
                if(!showPublic) {
                    showPublic = false;
                }

                if (!images.list.final || force) {
                    images.job = serverTab.call({
                        name: 'ImagesList',
                        progress: function imagesProgress(err, job) {

                            var data = job.__read();

                            function handleChunk (image) {

                                if(!showPublic && image.public !== false) {
                                    return;
                                }

                                if(!images.index[image.id]) {
                                    images.index[image.id] = image;
                                    images.list.push(image);
                                }
                            }

                            function handleResponse(chunk) {
                                if(chunk.status === 'error') {

                                    util.error(
                                        localization.translate(
                                            null,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            null,
                                            'machine',
                                            'Unable to retrieve images from datacenter {{name}}',
                                            { name: chunk.name }
                                        ),
                                        function () {}
                                    );
                                    return;
                                }

                                if(chunk.images) {
                                    chunk.images.forEach(handleChunk);
                                }
                            }

                            if (ng.isArray(data)) {
                                data.forEach(handleResponse);
                            } else {
                                handleResponse(data);
                            }
                        },
                        done: function (err, job) {
                            if (err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'machine',
                                    'Unable to retrieve images list'
                                )));
                                return;
                            }

                            images.list.final = true;
                        }
                    });
                }

                return images.job;
            };


            service.image = function(id) {
                if (id === true || (!id && !images.job)) {
                    service.updateImages();
                    return images.list;
                }

                if (!id) {
                    return images.list;
                }

                if (!images.index[id]) {
                    service.updateImages();
                }

//                if (!images.index[id] || (images.job && !images.job.finished)) {
//                    var ret = $q.defer();
//                    if (!machines.search[id]) {
//                        machines.search[id] = [];
//                    }
//                    machines.search[id].push(ret);
//
//                    return ret.promise;
//                }

                return images.index[id];
            };


            service.createImage = function(machineId, name, description) {
                var newImage = serverTab.call({
                    name: 'ImageCreate',
                    data: { machineId: machineId, name: name, description: description },
                    done: function(err, image) {
                        if (!err) {
                            util.message(
                                localization.translate(
                                    null,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Image "{{name}}" successfully created',
                                    { name: image.data.name }
                                ),
                                function () {}
                            );
                        } else {
                            util.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Unable to create image "{{name}}"',
                                    { name: image.data.name }
                                ),
                                function () {}
                            );
                        }
                    }
                });

                return newImage;
            };

            service.deleteImage = function (image) {
                image.state = 'deleting'; // Override state manually
                image.job = serverTab.call({
                    name: 'ImageDelete',
                    data: { imageId: image.id },
                    done: function(err, job) {
                        if (!err) {
                            util.message(
                                localization.translate(
                                    null,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Image "{{name}}" successfully deleted',
                                    { name: image.name }
                                ),
                                function () {}
                            );

                            $rootScope.$emit('forceUpdate');
                        } else {
                            util.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Unable to delete image "{{name}}"',
                                    { name: image.name }
                                ),
                                function () {}
                            );
                        }
                    }
                });

                return image;
            };

            return service;
        }]);
}(window.angular, window.JP.getModule('Machine')));
