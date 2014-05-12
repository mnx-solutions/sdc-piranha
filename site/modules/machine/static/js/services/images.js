'use strict';

(function (ng, app) {
    app.factory('Image', [
        'serverTab',
        '$q',
        'localization',
        'PopupDialog',
        'errorContext',
        'Dataset',
        function (serverTab, $q, localization, PopupDialog, errorContext,
            Dataset) {

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

                                if (!images.index[image.id]) {
                                    if(!image.actionButtons){
                                        image.actionButtons = true;
                                    }
                                    images.index[image.id] = image;
                                    images.list.push(image);
                                }
                            }

                            function handleResponse(chunk) {
                                if(chunk.status === 'error') {

                                    PopupDialog.error(
                                        localization.translate(
                                            null,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            null,
                                            'machine',
                                            'Unable to retrieve images from datacenter {{name}}.',
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


            service.createImage = function(machineId, datacenter, name, description, version) {
                var newImage = serverTab.call({
                    name: 'ImageCreate',
                    data: {
                        machineId: machineId,
                        name: name,
                        description: description,
                        datacenter: datacenter,
                        version: version
                    },
                    done: function(err, image) {
                        if (!err) {
                            PopupDialog.message(
                                localization.translate(
                                    null,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Image "{{name}}" successfully created.',
                                    { name: image.data.name }
                                ),
                                function () {}
                            );
                            service.updateImages(true);
                            Dataset.updateDatasets('all', true);
                        } else {
                            var detailMessage = err.body && err.body.message || err.message || String(err);
                            if (err.code === 'PrepareImageDidNotRun') {
                                detailMessage += '. You likely need to <a href="http://wiki.joyent.com/wiki/display/jpc2/Upgrading+Linux+Guest+Tools">upgrade Joyent Linux Guest Tools</a>.';
                            }
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Unable to create image "{{name}}": ' + detailMessage,
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
                    data: { imageId: image.id, datacenter: image.datacenter },
                    done: function(err, job) {
                        if (!err) {
                            PopupDialog.message(
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

                            images.list.splice(images.list.indexOf(image), 1);
                            delete images.index[image.id];
                            Dataset.updateDatasets('all', true);
                        } else {
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'machine',
                                    'Unable to delete image "{{name}}".',
                                    { name: image.name }
                                ),
                                function () {}
                            );
                        }
                    }
                });

                return image;
            };

            service.renameImage = function (image, callback) {
                image.state = 'renaming'; // Override state manually
                image.job = serverTab.call({
                    name: 'ImageRename',
                    data: { image: image },
                    done: function(err, job) {
                        if (!err) {
                            PopupDialog.message(
                                localization.translate(
                                    null,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    null,
                                    'image',
                                    'Image "{{name}}" renamed',
                                    { name: image.name }
                                ),
                                callback
                            );
                        } else {
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    null,
                                    'image',
                                    'Unable to rename image "{{name}}".',
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
