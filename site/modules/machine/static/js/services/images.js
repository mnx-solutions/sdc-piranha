'use strict';

(function (ng, app) {
    app.factory('Image', [
        '$rootScope',
        '$q',
        'serverTab',
        'localization',
        'PopupDialog',
        'ErrorService',
        'util',
        '$location',
        'notification',
        function ($rootScope, $q, serverTab, localization, PopupDialog, ErrorService, util, $location, notification) {

            var service = {};
            var list = [];
            var images = {index: {}, job: null, list: {private: [], all: []}, error: null, search: {}};
            var imageInfo = {};
            var IMAGES_PATH = '/images';
            var findImageIndexById = function (list, image) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i].id === image.id) {
                        return i;
                    }
                }
                return -1;
            };

            function handleChunk(image, action) {
                var old = null;
                var oldAll = null;
                var oldPrivate = null;
                var indexImage = images.index[image.id];
                var imagesList = images.list;
                var datacenterList = imagesList[image.datacenter] || [];
                var allList = imagesList['all'];
                var privateList = imagesList['private'];
                if (indexImage) {
                    old = findImageIndexById(datacenterList, image);
                    old = (old === -1) ? (datacenterList.length - 1) : old;
                    oldAll = findImageIndexById(allList, image);
                    oldAll = (oldAll === -1) ? (allList.length - 1) : oldAll;
                    oldPrivate = findImageIndexById(privateList, image);
                    oldPrivate = (oldPrivate === -1) ? (privateList.length - 1) : oldPrivate;
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
                    var result = images.list[datacenter].filter(function (image) {
                        return compareProperties(image, params);
                    });
                    result.error = images.list[datacenter].error;
                    return result;
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
                            function handleResponse(chunk) {
                                images.list[chunk.name] = [];
                                if (chunk.status === 'error') {
                                    images.error = images.list[chunk.name].error = err || chunk.error;
                                    if (!ErrorService.getLastErrors('dcUnreachable', chunk.name)) {
                                        ErrorService.setLastError('dcUnreachable', chunk.name,
                                            'Data center {{name}} is currently not available. We are working on getting this data center back on.',
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
                                                    'Unable to retrieve images from data center {{name}}.',
                                                    {name: chunk.name}
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

            service.image = function (params, updateCache) {
                var deferred = $q.defer();
                if (typeof params === 'string') {
                    params = {id: params};
                }
                if (updateCache) {
                    list = [];
                    images = {index: {}, job: null, list: {private: [], all: []}};
                }

                if (images.list.final && !images.error && !updateCache) {
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
                        var imageName = image.name;
                        if (!image.public || imageName === params.name && params.type &&
                            image.type !== params.type) {
                            return;
                        }
                        if (!listImages[imageName]) {
                            listImages[imageName] = {};
                        }

                        listImages[imageName][image.version] = image.id;
                        listVersions[imageName] = Object.keys(listImages[imageName]);

                        if (listVersions[imageName].length > 1) {
                            listVersions[imageName].sort(function (a, b) {
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
                            if (newMajor.length > 7) {
                                selectedMajor = newMajor;
                            }
                        });

                        var id;
                        if (params.forceMajorVersion && versions[params.forceMajorVersion]) {
                            id = imagesByName[versions[params.forceMajorVersion].slice(-1)];
                        }

                        if (selectedMajor && !params.forceMajorVersion) {
                            id = imagesByName[versions[selectedMajor].slice(-1)];
                        } else if (!params.forceMajorVersion) {
                            id = imagesByName[listVersions[params.name].slice(-1)];
                        }

                        var imageData = data.find(function (dataItem) {
                            return dataItem.id === id;
                        });

                        resolve = {
                            id: id,
                            description: imageData && imageData.description
                        };
                    }

                    deferred.resolve(resolve);
                });

                return deferred.promise;
            };

            service.getPopularImageList = function () {
                var job = serverTab.call({
                    name: 'ImagesPopularList'
                });
                return job.promise;
            };

            service.getSimpleImgList = function () {
                var job = serverTab.call({
                    name: 'ImagesSimpleList'
                });
                return job.promise;
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
                        {name: image.name}
                    )
                );
            }

            var capitalize = function (str) {
                return str.charAt(0).toUpperCase() + str.slice(1);
            };

            function getErrorMessage(image, err, isPopupMessage, action) {
                action = action || 'create';
                var errorMessage = 'Unable to ' + action + ' image ' + (image.name || '') + '.';
                if (isPopupMessage) {
                    errorMessage += ' ' + capitalize(err.message || err).replace('available', 'available.');
                }
                if (err.restCode === 'NotAuthorized') {
                    errorMessage = err.message;
                }
                return errorMessage;
            }

            function getSuccessMessage(imageName, action) {
                return 'Image "' + imageName + '" has successfully ' + action + '.';
            }

            service.getImage = function (datacenter, id) {
                var d = $q.defer();
                var imageInfoDatacenter = imageInfo[datacenter];
                if (imageInfoDatacenter && imageInfoDatacenter[id]) {
                    d.resolve(imageInfoDatacenter[id]);
                } else {
                    serverTab.call({
                        name: 'GetImage',
                        data: {uuid: id, datacenter: datacenter},
                        error: function (err) {
                            d.reject(err);
                        },
                        done: function (err, job) {
                            var res = job.__read();

                            if (!imageInfoDatacenter) {
                                imageInfoDatacenter = {};
                            }

                            imageInfoDatacenter[id] = res;
                            d.resolve(res);
                        }
                    });
                }

                return d.promise;
            };

            service.createImage = function (machineId, datacenter, name, description, version, os, locationCallback) {
                var id = window.uuid.v4();
                var image = {
                    state: 'creating',
                    'published_at': Date.now(),
                    machineId: machineId,
                    name: name,
                    description: description,
                    datacenter: datacenter,
                    version: version,
                    id: id,
                    os: os
                };

                handleChunk(image);

                var handleImageCreationError = function (imageError, image) {
                    var imagesPath = IMAGES_PATH;
                    var instanceDetailsPath = '/compute/instance';
                    var notificationMessage = 'New image "' + image.name + '" of version "' + image.version + '" creation has failed.';
                    handleChunk(image, 'remove');
                    $rootScope.$emit('createdImage', machineId);
                    var errorMessage = getErrorMessage(image, imageError, true);
                    if ((imageError.restCode === 'NotAuthorized' || imageError.restCode === 'NotAvailable') &&
                        $location.path().indexOf(instanceDetailsPath) !== -1) {
                        imagesPath = instanceDetailsPath;
                    }
                    if (errorMessage.indexOf('permission') !== -1) {
                        notificationMessage = errorMessage;
                    }
                    notification.popup(true, true, imagesPath, null, errorMessage, notificationMessage);
                };

                var jobCall = serverTab.call({
                    name: 'ImageCreate',
                    data: {
                        machineId: machineId,
                        name: name,
                        description: description,
                        datacenter: datacenter,
                        'published_at': image['published_at'],
                        version: version
                    },
                    initialized: function (err, job) {
                        if (err) {
                            showError(image, 'Unable to create image "{{name}}": ', err);
                            return;
                        }

                        images.list[datacenter] = images.list[datacenter] || [];
                        var index = images.list[datacenter].indexOf(image);
                        var indexAll = images.list['all'].indexOf(image);
                        var indexPrivate = images.list['private'].indexOf(image);
                        delete images.index[id];
                        image = job.initial.image;
                        image.datacenter = datacenter;
                        image['published_at'] = Date.now();
                        image.job = job.getTracker();
                        images.index[image.id] = image;
                        images.list[datacenter][index] = image;
                        images.list['all'][indexAll] = image;
                        images.list['private'][indexPrivate] = image;
                    },
                    done: function (err, job) {
                        var notificationMessage = 'New image "' + image.name + '" of version "' + image.version + '" ';
                        if (err) {
                            handleImageCreationError(err, image);
                            return;
                        }

                        var result = job.__read();
                        result.datacenter = datacenter;
                        notification.popup(false, false, IMAGES_PATH, null, notificationMessage + 'has been successfully created.');

                        $rootScope.$emit('createdImage', machineId);

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
                        handleImageCreationError(err, image);
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
                    data: {imageId: image.id, datacenter: image.datacenter},
                    done: function (err) {
                        if (!err) {
                            notification.popup(false, false, IMAGES_PATH, null, getSuccessMessage(image.name, 'deleted'));
                            handleChunk(image, 'remove');
                        } else {
                            image.state = 'active';
                            notification.popup(true, true, IMAGES_PATH, null, getErrorMessage(image, err, true, 'delete'), getErrorMessage(image, err, false, 'delete'));
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
                var job = serverTab.call({
                    name: 'ImageUpdate',
                    data: {uuid: image.id,
                            name: image.name,
                            datacenter: image.datacenter,
                            version: image.version,
                            description: image.description},
                    done: function (err) {
                        image.state = oldState;
                        if (!err) {
                            notification.popup(false, false, IMAGES_PATH, null, getSuccessMessage(image.name, 'updated'));
                            handleChunk(image, 'active');
                            callback();
                        } else {
                            notification.popup(true, true, IMAGES_PATH, null, getErrorMessage(image, err, true, 'update'), getErrorMessage(image, err, false, 'update'));
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
