'use strict';

(function (ng, app) {
    app.factory('Image', [
        'serverTab',
        'localization',
        'PopupDialog',
        'errorContext',
        'Dataset',
        function (serverTab, localization, PopupDialog, errorContext,
            Dataset) {

            var service = {};
            var images = {index: {}, job: {}, list: [], search: {}};

            function handleChunk (image) {
                var old = null;

                if (images.index[image.id]) {
                    old = images.list.indexOf(images.index[image.id]);
                }

                images.index[image.id] = image;

                if (images.search[image.id]) {
                    images.search[image.id].forEach(function (r) {
                        r.resolve(image);
                    });
                    delete images.search[image.id];
                }

                if (old === null) {
                    images.list.push(image);
                } else {
                    images.list[old] = image;
                }
            }

            service.updateImages = function (force, showPublic) {
                if (!showPublic) {
                    showPublic = false;
                }

                if (!images.list.final || force) {
                    images.job = serverTab.call({
                        name: 'ImagesList',
                        progress: function imagesProgress(err, job) {

                            var data = job.__read();

                            function handleChunk(image) {

                                if (!showPublic && image.public !== false) {
                                    return;
                                }

                                if (!images.index[image.id]) {
                                    if (!image.actionButtons) {
                                        image.actionButtons = true;
                                    }
                                    images.index[image.id] = image;
                                    images.list.push(image);
                                }
                            }

                            function handleResponse(chunk) {
                                if (chunk.status === 'error') {

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
                                        )
                                    );
                                    return;
                                }

                                if (chunk.images) {
                                    chunk.images.forEach(handleChunk);
                                }
                            }

                            if (ng.isArray(data)) {
                                data.forEach(handleResponse);
                            } else {
                                handleResponse(data);
                            }
                        },
                        done: function (err) {
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


            service.image = function (id) {
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


            service.createImage = function (machineId, datacenter, name, description, version) {
                var id = window.uuid.v4();
                var image = {
                    state: 'creating',
                    published_at: Date.now(),
                    machineId: machineId,
                    name: name,
                    description: description,
                    datacenter: datacenter,
                    version: version,
                    id: id
                };

                images.list.push(image);
                images.index[id] = image;

                function showError(image, err) {
                    var detailMessage = (err.body && err.body.message) || err.message || String(err);
                    if (err.code === 'PrepareImageDidNotRun') {
                        detailMessage += '. You likely need to <a href="http://wiki.joyent.com/wiki/display/jpc2/Upgrading+Linux+Guest+Tools">upgrade Joyent Linux Guest Tools</a>.';
                    }
                    return PopupDialog.error(
                        localization.translate(
                            null,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            null,
                            'machine',
                                'Unable to create image "{{name}}": ' + detailMessage,
                            { name: image.name }
                        )
                    );
                }

                var jobCall = serverTab.call({
                    name: 'ImageCreate',
                    data: {
                        machineId: machineId,
                        name: name,
                        description: description,
                        datacenter: datacenter,
                        version: version
                    },
                    initialized: function (err, job) {
                        if (err) {
                            showError(image, err);
                            return;
                        }

                         var index = images.list.indexOf(image);
                         delete images.index[id];
                         image = job.initial.image;
                         image.datacenter = datacenter;
                         image.published_at = Date.now();
                         image.job = job.getTracker();
                         images.index[image.id] = image;
                         images.list[index] = image;
                    },
                    done: function (err, job) {
                        if (err) {
                            showError(image, err);
                            images.list.splice(images.list.indexOf(image), 1);
                            delete images.index[id];
                            return;
                        }

                        var result = job.__read();
                        result.datacenter = datacenter;
                        handleChunk(result);
                        Dataset.updateDatasets('all', true);
                    },
                    progress: function (err, job) {
                        var step = job.step;
                        if (step) {
                            Object.keys(step).forEach(function (k) {
                                image[k] = step[k];
                            });
                        }
                    },
                    error: function (err) {
                        if (err) {
                            showError(image, err);
                        }
                        images.list.splice(images.list.indexOf(image), 1);
                        delete images.index[id];
                    }
                });

                image.job = jobCall.getTracker();
                return jobCall;
            };

            service.deleteImage = function (image) {
                image.state = 'deleting'; // Override state manually
                var job = serverTab.call({
                    name: 'ImageDelete',
                    data: { imageId: image.id, datacenter: image.datacenter },
                    done: function (err) {
                        if (!err) {
                            images.list.splice(images.list.indexOf(image), 1);
                            delete images.index[image.id];
                            Dataset.updateDatasets('all', true);
                        } else {
                            image.state = 'active';
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
                                )
                            );
                        }
                    }
                });

                image.job = job.getTracker();
                return job;
            };

            service.renameImage = function (image, callback) {
                var oldState = image.state;
                image.state = 'renaming'; // Override state manually
                var job = serverTab.call({
                    name: 'ImageRename',
                    data: { id: image.id, name: image.name, datacenter: image.datacenter },
                    done: function (err) {
                        image.state = oldState;
                        if (!err) {
                            Dataset.updateDatasets('all', true);
                            callback();
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
                                )
                            );
                        }
                    }
                });

                image.job = job.getTracker();
                return job;
            };

            return service;
        }]);
}(window.angular, window.JP.getModule('Machine')));
