'use strict';

(function (app) {
    app.factory('Image', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',
        function (serverTab, $q, localization, notification, errorContext) {

            var service = {};
            var images = { job: {}, list: {}};

            service.updateImages = function() {
                if(!images.list.final) {
                    images.job.finished = false;
                    images.job = serverTab.call({
                        name: 'ImagesList',
                        done: function(err, job) {
                            images.job.finished = true;

                            if(err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'machine',
                                    'Unable to retrieve images list'
                                )));
                                return;
                            }

                            var result = job.__read();
                            images.list = {};
                            images.list.images = [];

                            result.forEach(function(e) {
                                images.list.images.push(e);
                            });

                            images.list.final = true;
                        }
                    });
                }

                return images.job;
            };

            service.image = function(force, id) {

                if(!force)
                    force = false;

                if(!id && !images.list.final || force) {
                    var job = service.updateImages();
                    return job.deferred;
                }

                var ret = $q.defer();

                if(!id) {
                    if(images.list.final) {
                        ret.resolve(images.list);
                    } else {
                        images.job.deferred.then(function (value) {
                           ret.resolve(value);
                        });
                    }
                }

                return ret.promise;
            };


            service.createImage = function(machineId) {

                var newImage = serverTab.call({
                    name: 'ImageCreate',
                    data: { machineId: machineId },
                    done: function(err, image) {
                        notification.push(image.name, { type: 'success' },
                            localization.translate(null,
                                'machine',
                                'Image "{{name}}" successfully created',
                                { name: image.name }
                            )
                        );
                    }
                });

                return newImage.job;
            };

            return service;
        }]);
}(window.JP.getModule('Machine')));