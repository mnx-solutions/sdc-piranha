'use strict';

(function (ng, app) {
    app.factory('Image', [
        '$q',
        'serverTab',
        'localization',
        'PopupDialog',
        'ErrorService',
        'util',
        function ($q, serverTab, localization, PopupDialog, ErrorService, util) {

            var service = {};
            var list = [];
            var images = {index: {}, job: null, list: {private: [], all: []}, error: null, search: {}};

            function handleChunk(image, action) {
                var old = null;
                var oldAll = null;
                var oldPrivate = null;
                var indexImage = images.index[image.id];
                var imagesList = images.list;
                var datacenterList = imagesList[image.datacenter];
                var allList = imagesList['all'];
                var privateList = imagesList['private'];
                if (indexImage) {
                    old = (datacenterList.indexOf(image) === -1) ? (datacenterList.length - 1) : datacenterList.indexOf(image);
                    oldAll = (allList.indexOf(image) === -1) ? (allList.length - 1) : allList.indexOf(image);
                    oldPrivate = (privateList.indexOf(image) === -1) ? (privateList.length - 1) : privateList.indexOf(image);
                    if (action && action === 'remove') {
                        datacenterList.splice(old, 1);
                        allList.splice(oldAll, 1);
                        privateList.splice(oldPrivate, 1);
                        delete images.index[image.id];
                    } else {
                        datacenterList[old] = image;
                        allList[oldAll] = image;
                        privateList[oldPrivate] = image;
                        images.index[image.id] = image;
                    }
                } else if (!action) {
                    datacenterList.push(image);
                    allList.push(image);
                    privateList.push(image);
                    images.index[image.id] = image;
                }

            }

            function compareProperties(image, params) {
                var paramsProps = Object.getOwnPropertyNames(params);

                for (var i = 0; i < paramsProps.length; i++) {
                    var propName = paramsProps[i];

                    if (image.hasOwnProperty(propName) && image[propName] !== params[propName]) {
                        return false;
                    }
                }
                return true;
            }

            function filterImages(params) {
                if (params) {
                    var datacenter = params.datacenter || 'all';
                    if (params.id) {
                        return images.list[datacenter].find(function (image) {
                            return image.id === params.id;
                        });
                    }
                    return images.list[datacenter].filter(function (image) {
                        return compareProperties(image, params);
                    });
                } else {
                    return images.list['private'];
                }
            }

            service.updateImages = function () {
                if (!images.job) {
                    images.job = serverTab.call({
                        name: 'ImagesList',
                        error: function (err) {
                            images.error = err;
                            images.job.promise.catch(err);
                        },
                        progress: function (err, job) {
                            var data = job.__read();
                            ErrorService.flushErrors('dcUnreachable', 'all');
                            function handleResponse(chunk) {
                                images.list[chunk.name] = [];
                                if (chunk.status === 'error') {
                                    images.error = err;
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
                                    chunk.images.forEach(function (image) {
                                        if (!image.actionButtons) {
                                            image.actionButtons = true;
                                        }
                                        if (!images.index[image.id]) {
                                            images.index[image.id] = image;
                                            images.list['all'].push(image);
                                            if (image.public === false) {
                                                images.list['private'].push(image);
                                            }
                                        }
                                        images.list[chunk.name].push(image);
                                    });
                                }
                            }

                            if (ng.isArray(data)) {
                                data.forEach(handleResponse);
                            } else {
                                handleResponse(data);
                            }
                        },
                        done: function () {
                            images.list.final = true;
                        }
                    });
                }
                return images.job;
            };

            service.image = function (params, force) {
                var deferred = $q.defer();
                if (typeof params === 'string') {
                    params = {id: params};
                }

                if (images.list.final && !images.error) {
                    list = filterImages(params);
                    if (list) {
                        deferred.resolve(list);
                    } else {
                        deferred.reject(list);
                    }
                    return deferred.promise;
                } else {
                    service.updateImages().deferred.promise.then(function () {
                        list = filterImages(params);
                        if (list) {
                            deferred.resolve(list);
                        } else {
                            deferred.reject(list);
                        }
                    }, deferred.reject);

                    return deferred.promise;
                }
            };

            service.simpleImage = function (params) {
                var deferred = $q.defer();

                service.updateImages();
                images.job.deferred.promise.then(function () {
                    var data = images.list[params.datacenter];

                    var listImages = {};
                    var listVersions = [];

                    data.forEach(function (image) {
                        if (!image.public) {
                            return;
                        }
                        if (!listImages[image.name]) {
                            listImages[image.name] = {};
                        }

                        listImages[image.name][image.version] = image.id;
                        listVersions[image.name] = Object.keys(listImages[image.name]);

                        if (listVersions[image.name].length > 1) {
                            listVersions[image.name].sort(function (a, b) {
                                return util.cmpVersion(a, b);
                            });
                        }
                    });

                    var resolve;
                    var imagesByName = listImages[params.name];
                    if (imagesByName) {
                        var versions = {};
                        var lastMajor = null;
                        var selectedMajor = null;
                        listVersions[params.name].forEach(function (version) {
                            var re = /\w+/g;
                            var versionType = version.match(re);
                            var newMajor = versionType[0];
                            if (!versions[newMajor]) {
                                versions[newMajor] = [];
                            }
                            versions[newMajor].push(version);
                            if (versionType.length > 1) {
                                if (selectedMajor < lastMajor) {
                                    selectedMajor = lastMajor;
                                }
                                lastMajor = newMajor;
                            }
                        });

                        if (params.forceMajorVersion && versions[params.forceMajorVersion]) {
                            resolve = imagesByName[versions[params.forceMajorVersion].slice(-1)];
                        }

                        if (selectedMajor && !params.forceMajorVersion) {
                            resolve = imagesByName[versions[selectedMajor].slice(-1)];
                        } else if (!params.forceMajorVersion) {
                            resolve = imagesByName[listVersions[params.name].slice(-1)];
                        }
                    }

                    deferred.resolve(resolve);
                });

                return deferred.promise;
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


            service.createImage = function (machineId, datacenter, name, description, version, locationCallback) {
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

                handleChunk(image);

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

                        var index = images.list[datacenter].indexOf(image);
                        var indexAll = images.list['all'].indexOf(image);
                        var indexPrivate = images.list['private'].indexOf(image);
                        delete images.index[id];
                        image = job.initial.image;
                        image.datacenter = datacenter;
                        image.published_at = Date.now();
                        image.job = job.getTracker();
                        images.index[image.id] = image;
                        images.list[datacenter][index] = image;
                        images.list['all'][indexAll] = image;
                        images.list['private'][indexPrivate] = image;
                    },
                    done: function (err, job) {
                        if (err) {
                            handleChunk(image, 'remove');
                            showError(image, 'Unable to create image "{{name}}": ', err);
                            return;
                        }

                        var result = job.__read();
                        result.datacenter = datacenter;
                        handleChunk(result);
                    },
                    progress: function (err, job) {
                        if (!err && angular.isFunction(locationCallback)) {
                            locationCallback();
                            locationCallback = undefined;
                        }
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
                        handleChunk(image, 'remove');
                    }
                });
                image.job = jobCall.getTracker();
                return jobCall;
            };

            service.deleteImage = function (image) {
                image.state = 'deleting'; // Override state manually
                handleChunk(image);
                var job = serverTab.call({
                    name: 'ImageDelete',
                    data: { imageId: image.id, datacenter: image.datacenter },
                    done: function (err) {
                        if (!err) {
                            handleChunk(image, 'remove');
                        } else {
                            image.state = 'active';
                            showError(image, 'Unable to delete image "{{name}}": ', err);
                        }
                    }
                });

                image.job = job.getTracker();
                return job;
            };
            service.resetImage = function (oldImage, callback) {
                handleChunk(oldImage);
                callback();
            };
            service.updateImage = function (image, callback) {
                var oldState = image.state;
                image.state = 'updating'; // Override state manually
                handleChunk(image);
                var job = serverTab.call({
                    name: 'ImageUpdate',
                    data: { uuid: image.id,
                            name: image.name,
                            datacenter: image.datacenter,
                            version: image.version,
                            description: image.description},
                    done: function (err) {
                        image.state = oldState;
                        if (!err) {
                            handleChunk(image, 'active');
                            callback();
                        } else {
                            showError(image, 'Unable to update image "{{name}}": ', err);
                        }
                    }
                });
                image.job = job.getTracker();
                handleChunk(image);
                return job;
            };

            return service;
        }]);
}(window.angular, window.JP.getModule('Machine')));
