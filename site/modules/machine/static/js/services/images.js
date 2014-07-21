'use strict';

(function (ng, app) {
    app.factory('Image', [
        '$q',
        'serverTab',
        'localization',
        'PopupDialog',
        'errorContext',
        'Dataset',
        'ErrorService',
        function ($q, serverTab, localization, PopupDialog, errorContext,
            Dataset, ErrorService) {

            var service = {};
            var promiseById;
            var images = {index: {}, job: {pending: false}, list: [], error: undefined, search: {}};

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

            service.listImages = function (force, showPublic) {
                if (!showPublic) {
                    showPublic = false;
                }
                var deferred = $q.defer();
                if (!images.job || !images.job.pending) {
                    images.job = {};
                    images.job.deferred = deferred;
                    images.job.pending = true;
                } else {
                    images.job.deferred.promise.then(deferred.resolve, deferred.reject);
                    return deferred.promise;
                }
                if (!force && images.list.final && !images.error) {
                    deferred.resolve(images.list);
                    return deferred.promise;
                }
                images = {index: {}, job: {pending: false}, list: [], error: undefined, search: {}};
                serverTab.call({
                    name: 'ImagesList',
                    error: function (err) {
                        images.job.pending = false;
                        deferred.reject(err);
                    },
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

                        ErrorService.flushErrors('dcUnreachable', 'all');
                        function handleResponse(chunk) {
                            if (chunk.status === 'error') {
                                ErrorService.setLastError('dcUnreachable', 'all', true);
                                if (!ErrorService.getLastErrors('dcUnreachable', chunk.name)) {
                                    ErrorService.setLastError('dcUnreachable', chunk.name,
                                        'Datacenter {{name}} is currently not available. We are working on getting this datacenter back on.',
                                        {name: chunk.name});

                                    PopupDialog.error(
                                        localization.translate(
                                            null,
                                            null,
                                            'Error'
                                        ), chunk.error && chunk.error.restCode === 'NotAuthorized' ? chunk.error.message :
                                        localization.translate(
                                            null,
                                            'machine',
                                            'Unable to retrieve images from datacenter {{name}}.',
                                            { name: chunk.name }
                                        )
                                    );
                                }
                                return;
                            }

                            ErrorService.flushErrors('dcUnreachable', chunk.name);

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
                        images.job.pending = false;
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(images.list);
                            images.list.final = true;
                        }
                    }
                });

                return deferred.promise;
            };

            service.getImage = function (id) {
                var deferred = $q.defer();
                service.listImages().then(function (images) {
                    var imageById = images.find(function (image) {
                        return image.id === id;
                    });
                    if (!imageById) {
                        var err = new Error();
                        err.message = 'No image found';
                        deferred.reject(err);
                    } else {
                        deferred.resolve(imageById);
                    }

                }, function (err) {
                    deferred.reject(err);
                });
            };

            function showError(image, message, err) {
                var detailMessage = (err.body && err.body.message) || err.message || String(err);
                if (err.code === 'PrepareImageDidNotRun') {
                    detailMessage += '. You likely need to <a href="http://wiki.joyent.com/wiki/display/jpc2/Upgrading+Linux+Guest+Tools">upgrade Joyent Linux Guest Tools</a>.';
                }
                return PopupDialog.error(
                    localization.translate(
                        null,
                        null,
                        'Error'
                    ), err && err.restCode === 'NotAuthorized' ? err.message :
                    localization.translate(
                        null,
                        'image',
                            message + detailMessage,
                        { name: image.name }
                    )
                );
            }


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
                            showError(image, 'Unable to create image "{{name}}": ', err);
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
                            showError(image, 'Unable to create image "{{name}}": ',err);
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
                            showError(image, 'Unable to create image "{{name}}": ', err);
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
                            showError(image, 'Unable to delete image "{{name}}": ', err);
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
                    error: function (err) {
                        image.state = oldState;
                        callback(err);
                    },
                    done: function (err) {
                        image.state = oldState;
                        if (!err) {
                            Dataset.updateDatasets('all', true);
                            callback();
                        } else {
                            showError(image, 'Unable to rename image "{{name}}": ', err);
                        }
                    }
                });

                image.job = job.getTracker();
                return job;
            };

            return service;
        }]);
}(window.angular, window.JP.getModule('Machine')));
