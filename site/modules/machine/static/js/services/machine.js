'use strict';
(function (ng, app) { app.factory('Machine', [
    'serverTab',
    '$rootScope',
    '$q',
    '$timeout',
    'localization',
    'Package',
    'Image',
    'util',
    'PopupDialog',
    'Account',
    '$location',
    'ErrorService',
    'notification',
    function (serverTab, $rootScope, $q, $timeout, localization, Package, Dataset, util, PopupDialog, Account, $location, ErrorService, notification) {

        var service = {};
        var machines = {job: null, index: {}, list: [], search: {}};
        var createInstancePageConfig = null;
        var INSTANCES_PATH = '/compute';
        var DOCKER_CONTAINER_PATH = '/docker/container/';
        var cacheErrors = [];

        service.initCreateInstancePageConfig = function (config) {
            createInstancePageConfig = config;
        };
        service.setCreateInstancePage = function (page) {
            if (createInstancePageConfig && createInstancePageConfig.loaded()) {
                createInstancePageConfig.page = page;
                createInstancePageConfig.dirty(true);
                createInstancePageConfig.$save();
            }
        };
        service.gotoCreatePage = function () {
            if (!(createInstancePageConfig && createInstancePageConfig.loaded())) {
                $location.path('/compute/create/simple');
                return;
            }
            if (createInstancePageConfig.page === undefined || (createInstancePageConfig.page === 'recent' && $rootScope.features.recentInstances !== 'enabled')) {
                createInstancePageConfig.page = 'simple';
                createInstancePageConfig.dirty(true);
                createInstancePageConfig.$save();
            }
            var page = createInstancePageConfig.page ? '/' + createInstancePageConfig.page : '';
            $location.path('/compute/create' + page);
        };
        service.gotoDockerDashboard = function (machines, isDeletedDockerMachine) {
            machines = machines || [];
            isDeletedDockerMachine = isDeletedDockerMachine || false;
            var dockerMachine = machines.find(function (machine) {
                return machine.tags && machine.tags.hasOwnProperty('JPC_tag') && machine.tags['JPC_tag'] === 'DockerHost';
            });
            if (isDeletedDockerMachine && !dockerMachine) {
                $rootScope.dockerHostsAvailable = false;
                if ($location.path().indexOf('/docker') !== -1) {
                    $location.path('/docker');
                }
            }
        };

        service.getMachineType = function (machine, image) {
            if (machine.image === image.id && image.name === 'docker-layer') {
                machine.type = 'Docker Container';
            }
            return machine.type;
        };

        function wrapMachine (machine) {
            var p = null;
            var i = null;
            if (!machine._Package && !machine._Dataset) {
                Object.defineProperties(machine, {
                    _Package: {
                        get: function () {
                            if (!p) {
                                p = {};
                                if (machine.package) {
                                    $q.when(Package.package(machine.package), function (pack) {
                                        Object.keys(pack).forEach(function (k) {
                                            p[k] = pack[k];
                                        });
                                    });
                                }
                            }
                            return p;

                        }
                    },
                    _Dataset: {
                        get: function () {
                            if (!i) {
                                i = {};
                                if (machine.image) {
                                    Image.image(machine.image).then(function (dataset) {
                                        Object.keys(dataset).forEach(function (k) {
                                            i[k] = dataset[k];
                                        });
                                    });
                                }
                            }
                            return i;
                        }
                    }
                });
            }
            return machine;
        }

        function handleChunk (machine) {
            var old = null;

            machine = wrapMachine(machine);
            machine.publicIps = machine.privateIps = [];
            if (ng.isArray(machine.ips)) {
                machine.publicIps = machine.ips.filter(function (ip) {
                    return !util.isPrivateIP(ip);
                });
                machine.privateIps = machine.ips.filter(util.isPrivateIP);
            }

            if (machines.index[machine.id]) {
                old = machines.list.indexOf(machines.index[machine.id]);
            }

            machines.index[machine.id] = machine;

            if (machines.search[machine.id]) {
                machines.search[machine.id].forEach(function (r) {
                    r.resolve(machine);
                });
                delete machines.search[machine.id];
            }

            if (old === null) {
                machines.list.push(machine);
            } else {
                machines.list[old] = machine;
            }
        }

        service.getSimpleImgList = function() {
            var job = serverTab.call({
                name: 'ImagesSimpleList',
                done: function (err, data) {
                    if (err) {
                        return false;
                    }

                    return data;
                }
            });
            return job.promise;
        };

        service.getCacheErrors = function () {
            return cacheErrors;
        };

        service.clearCacheErrors = function () {
            cacheErrors = [];
        };

        service.updateMachines = function (authorizationErrorDisable) {
            if (!machines.job || machines.job.finished) {
                machines.list.final = false;
                machines.job = serverTab.call({
                    name: 'MachineList',
                    progress: function (err, job) {
                        var data = job.__read();
                        function handleResponse(chunk) {
                            if (chunk.status === 'error') {
                                if (!authorizationErrorDisable && $location.path() !== INSTANCES_PATH && chunk.error && chunk.error.message && chunk.error.message.indexOf('permission') > 0) {
                                    cacheErrors.push(chunk.error.message);
                                    return;
                                }
                                if (authorizationErrorDisable && chunk.error) {
                                    return;
                                }

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
                                            'Unable to retrieve instances from data center {{name}}.',
                                            {name: chunk.name}
                                        )
                                    );
                                }
                                return;
                            }

                            ErrorService.flushErrors('dcUnreachable', chunk.name);

                            if (chunk.machines) {
                                chunk.machines.forEach(handleChunk);
                            }
                        }

                        if (ng.isArray(data)) {
                            data.forEach(handleResponse);
                        } else {
                            handleResponse(data);
                        }
                    },

                    done: function() {
                        Object.keys(machines.search).forEach(function (id) {
                            if (!machines.index[id] && machines.search[id]) {
                                machines.search[id].forEach(function (r) {
                                    r.reject();
                                });
                            }
                        });

                        machines.list.final = true;
                    }
                });
            }

            return machines.job;
        };

        service.pollMachines = function (timeout, usedOnce) {
            function mapStates () {
                var states = {};

                machines.list.forEach(function (machine) {
                    states[machine.id] = machine.state;
                });

                return states;
            }

            $timeout(function () {
                serverTab.call({
                    name: 'MachineState',
                    data: {states: mapStates()},

                    done: function (err, job) {
                        var data = job.__read();

                        if (data) {
                            data.forEach(function (chunk) {
                                if (chunk.state.indexOf('delete') !== -1) {
                                    var index = -1;
                                    for (var i = 0, c = machines.list.length; i < c; i++) {
                                        if (machines.list[i].id === chunk.id) {
                                            index = i;
                                            break;
                                        }
                                    }

                                    if (index !== -1) {
                                        machines.list.splice(index, 1);
                                        delete machines.index[chunk.id];
                                    }
                                } else {
                                    handleChunk(chunk);
                                }
                            });
                        }

                        $rootScope.$broadcast('event:pollComplete');
                        if (!usedOnce) {
                            service.pollMachines(timeout);
                        }
                    }
                });
            }, timeout);
        };

        service.machine = function (id) {
            if (id === true || (!id && !machines.job)) {
                service.updateMachines();
                return machines.list;
            }

            if (!id) {
                return machines.list;
            }

            if (!machines.index[id]) {
                service.updateMachines();
            }

            if (!machines.index[id] || (machines.job && !machines.job.finished)) {
                var ret = $q.defer();
                if (!machines.search[id]) {
                    machines.search[id] = [];
                }
                machines.search[id].push(ret);

                return ret.promise;
            }

            return machines.index[id];
        };

        if (!machines.job) {
            // run updateMachines
            service.updateMachines(false);
        }

        function changeState(opts) {
            return function (uuid) {
                function start() {
                    var stateChanged = true;
                    machine.prevState = machine.state;
                    switch (opts.name) {
                        case 'MachineRename' :
                            machine.state = 'renaming';
                            break;
                        case 'MachineResize' :
                            machine.state = 'resizing';
                            break;
                        case 'MachineStart' :
                            machine.state = 'starting';
                            break;
                        case 'MachineStop' :
                            machine.state = 'stopping';
                            break;
                        case 'MachineReboot' :
                            machine.state = 'rebooting';
                            break;
                        case 'MachineDelete' :
                            machine.state = 'deleting';
                            break;
                        default :
                            stateChanged = false;
                            break;
                    }

                    if (!machine.job || machine.job.finished) {
                        opts.data = opts.data || {};
                        opts.data.uuid = uuid;
                        opts.data.datacenter = machine.datacenter;

                        if (!opts.progress) {
                            opts.progress = function (err, data) {
                                var step = data.step;
                                if (step && typeof (step) === 'object') {
                                    Object.keys(step).forEach(function (k) {
                                        if (!stateChanged || k !== 'state') {
                                            data.machine[k] = step[k];
                                        }
                                    });
                                }
                            };
                        }
                        if (!opts.done) {
                            opts.done = function (err, job) {
                                showNotification(err, job);
                            };
                        }
                        var job = serverTab.call(ng.copy(opts));
                        job.machine = machine;
                        machine.job = job.getTracker();
                    }
                    return machine.job.deferred.promise;
                }

                var machine = service.machine(uuid);
                if (machine.id) {
                    var promise = start();
                    promise.then(
                        function (result) {
                            if (result && typeof result === 'object') {
                                Object.keys(result).forEach(function (k) {
                                    machine[k] = result[k];
                                });
                            }
                        },
                        function (err) {
                            var message = localization.translate(
                                null,
                                'machine',
                                'Unable to execute command "{{command}}" for instance {{uuid}}. ',
                                {
                                    command: opts.name,
                                    uuid: machine.id
                                }
                            );
                            if (err.restCode === 'NotAuthorized') {
                                machine.state = machine.prevState;
                                if ($location.path().indexOf(INSTANCES_PATH) === -1 ||
                                    $location.path().indexOf(INSTANCES_PATH + '/create') !== -1) {
                                    return;
                                }
                                message = err.message.indexOf('getmachine') !== -1 ? 'Can not get machine status. ' + err.message : err.message;
                            }
                            PopupDialog.error(
                                localization.translate(
                                    null,
                                    null,
                                    'Error'
                                ), message
                            );
                        });
                    return promise;
                }

                var d = $q.defer();
                machine.then(function(m) {
                    machine = m;
                    start().then(d.resolve, d.reject);
                });

                return d.promise;
            };
        }

        function showNotification(err, job, isTagsMetadataAction) {
            var instancesPath = INSTANCES_PATH;
            var notificationMessage;
            if (!isTagsMetadataAction) {
                var machine = job.machine || job.initial.machine;
                notificationMessage = 'Instance "' + machine.name + '" ';
                if (err) {
                    notificationMessage += machine.state + ' has been failed.';
                    if (err.message && err.message.indexOf('permission') !== -1) {
                        notificationMessage = err.message;
                    }
                } else {
                    var machineState = machine.state.replace('ing', 'ed');
                    if (machineState === 'provisioned') {
                        machineState = 'created';
                    }
                    notificationMessage += 'has been successfully ' + machineState + '.';
                }
            } else if (job.data && (job.data.tags || job.data.metadata)) {
                instancesPath += '/instance';
                if ($location.path().indexOf(DOCKER_CONTAINER_PATH) !== -1) {
                    instancesPath = DOCKER_CONTAINER_PATH;
                }
                if (err) {
                    notificationMessage = err.message || err;
                } else {
                    var collection = job.data.tags;
                    var item = 'Tag "';
                    if (!collection) {
                        collection = job.data.metadata;
                        item = 'Metadata "';
                    }
                    if (typeof (collection) === 'string') {
                        collection = item + collection;
                    } else {
                        var collectionKeys = Object.keys(collection);
                        collection = item + collectionKeys[collectionKeys.length - 1];
                    }
                    var action = ['Create', 'Update', 'Delete'].filter(function (action) {
                        return job.name.indexOf(action) !== -1;
                    })[0].toLowerCase();
                    notificationMessage = collection + '" has successfully ' + action + 'd.';
                }
            }
            notification.popup(false, err, instancesPath, null, notificationMessage);
        }

        service.startMachine = changeState({name: 'MachineStart'});

        service.stopMachine = changeState({name: 'MachineStop'});

        service.rebootMachine = changeState({name: 'MachineReboot'});

        service.deleteMachine = changeState({
            name: 'MachineDelete',
            done: function(err, job) {
                if (err && err.message.indexOf('getmachine') < 0) {
                    var errorMessage = getMessage(job.machine, err, 'execute command "' + job.name + '" for');
                    if (err.restCode === 'NotAuthorized') {
                        errorMessage = err.message;
                        job.machine.state = job.machine.prevState;
                    }
                    notification.popup(true, true, INSTANCES_PATH, null, errorMessage, err.message || err);
                    return;
                }

                machines.list.splice(machines.list.indexOf(job.machine), 1);
                if (job.machine.tags && job.machine.tags.sdc_docker) {
                    $rootScope.$emit('clearDockerCache');
                }
                delete machines.index[job.machine.id];
                showNotification(err, job);
            }
        });

        service.listFirewallRules = function (machine) {
            var job = serverTab.call({
                name: 'MachineRuleList',
                data: {
                    machineId: machine.id,
                    datacenter: machine.datacenter
                }
            });

            //machine.job = job.getTracker();
            return job.promise;
        };

        service.resizeMachine = function (uuid, sdcpackage) {
            var fn = changeState({
                name: 'MachineResize',
                data: {
                    sdcpackageId: sdcpackage.id,
                    sdcpackageName: sdcpackage.name
                }
            });

            return fn(uuid);
        };

        service.renameMachine = function(uuid, newName) {

            var fn = changeState({
                name: 'MachineRename',
                data: {name: newName}
            });

            return fn(uuid);
        };

        function showError(instance, err, callback) {
            return PopupDialog.errorObj(err, callback, localization.translate(
                null,
                'machine',
                'Unable to create instance {{name}} ({{uuid}}).',
                {
                    name: (instance.name || ''),
                    uuid: (instance.id || '')
                }
            ) + ' ' + (err.message || err));
        }

        function getMessage(instance, err, action) {
            action = action || 'create';
            return 'Unable to ' + action + ' instance' + (' ' + instance.name || '') + '. ' + (err.message || err);
        }

        service.provisionMachine = function (data) {
            var id = window.uuid.v4();
            var machine = {
                state: 'creating',
                name: data.name,
                created: Date.now(),
                datacenter: data.datacenter,
                id: id
            };

            machines.list.push(machine);
            machines.index[id] = machine;

            function setNewMachine(newMachine) {
                var oldIndex = machines.list.indexOf(machine);
                if (newMachine) {
                    machine = newMachine;
                }
                delete machines.index[id];
                if (oldIndex !== -1) {
                    machines.list[oldIndex] = machine;
                }
                machines.index[machine.id] = machine;

            }

            var jobCall = serverTab.call({
                name: 'MachineCreate',
                data: data,
                initialized: function (err, job) {
                    if (err) {
                        showError(machine, err);
                        return;
                    }

                    var initialMachine = job.initial.machine;
                    if (!initialMachine.id) {
                        return;
                    }

                    setNewMachine(initialMachine);
                    machine.datacenter = data.datacenter;
                    machine.job = job.getTracker();
                },

                done: function (err, job) {
                    if (err) {
                        notification.popup(true, true, INSTANCES_PATH, null, getMessage(machine, err), err.message || err);
                        machines.list.splice(machines.list.indexOf(machine), 1);
                        delete machines.index[id];
                        return;
                    }
                    var result = job.__read();
                    result.datacenter = data.datacenter;

                    if (machine.id !== result.id) {
                        machine.id = result.id;
                        setNewMachine();
                    }

                    showNotification(err, {machine: result});
                    if (result.tags['JPC_tag'] === 'DockerHost') {
                        $rootScope.$emit('clearDockerCache', result);
                    }
                    handleChunk(result);
                },

                progress: function (err, job) {
                    var step = job.step;
                    if (step) {
                        Object.keys(step).forEach(function (k) {
                            machine[k] = step[k];
                        });
                    }
                },

                error: function(err) {
                    var isGetMachineError = err && err.restCode === 'NotAuthorized' && err.message.indexOf('getmachine') !== -1;
                    if (isGetMachineError) {
                        err.message = 'Can not get machine status. ' + err.message;
                        return notification.popup(true, true, INSTANCES_PATH, null, err.message);
                    } else if (err.message && err.message.indexOf('QuotaExceeded:') !== 0 || typeof (err) === 'string') {
                        notification.popup(true, true, INSTANCES_PATH, null, getMessage(machine, err), err.message || err);
                    }
                    if (!isGetMachineError) {
                        machines.list.splice(machines.list.indexOf(machine), 1);
                        delete machines.index[id];
                    }
                }
            });

            machine.job = jobCall.getTracker();
            return jobCall;
        };

        service.hasMachineCreatingInProgress = function (callback) {
            service.listAllMachines().then(function (machines) {
                var hasCreating = machines.some(function (machine) {
                    return machine.state === 'creating';
                });
                callback({
                    hasCreating: hasCreating,
                    machines: machines
                });
            });
        };

        service.waitForCreatingMachinesToFinish = function (callback) {
            service.hasMachineCreatingInProgress(function (result) {
                if (result.hasCreating) {
                    setTimeout(function () {
                        service.waitForCreatingMachinesToFinish(callback);
                    }, 1000);
                } else {
                    callback(result.machines);
                }
            });
        };

        function bindCollectionCRUD(collectionName) {
            var upperCollectionName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

            function createData(machine, data) {
                var out = {uuid: machine.id, datacenter: machine.datacenter};
                if (data) {
                    out[collectionName] = data;
                }
                return out;
            }

            function done(machine, d, deleteReadJob) {
                return function (error, job) {
                    if (error) {
                        if (error.message && error.message.indexOf('listmachinemetadata') === -1 &&
                            error.message.indexOf('listmachinetags') === -1) {
                            showNotification(error, job, true);
                        }
                        return d.reject(error);
                    }

                    var data = job.__read();
                    var oldCredentials = machine[collectionName].credentials;
                    machine[collectionName] = data;
                    if (oldCredentials) {
                        data.credentials = oldCredentials;
                    }
                    if (job.name.indexOf('List') === -1) {
                        showNotification(error, job, true);
                    }
                    d.resolve(data);
                    if (deleteReadJob) {
                        delete machine[collectionName + 'ReadJob'];
                    }
                };
            }

            function getMachine(id, callback) {
                var machine = service.machine(id);
                $q.when(machine).then(callback);
            }

            function create(machineId, items) {
                var d = $q.defer();
                getMachine(machineId, function (machine) {
                    var currentItems = machine[collectionName];
                    var newItems = {};
                    Object.keys(items).forEach(function (key) {
                        if (!currentItems.hasOwnProperty(key)) {
                            newItems[key] = items[key];
                        }
                    });
                    serverTab.call({
                        name: 'Machine' + upperCollectionName + 'Create',
                        data: createData(machine, newItems),
                        done: done(machine, d),
                        error: done(machine, d)
                    });
                });
                return d.promise;
            }
            function read(machineId) {
                var d = $q.defer();
                getMachine(machineId, function (machine) {
                    if (machine[collectionName + 'ReadJob']) {
                        return machine[collectionName + 'ReadJob'];
                    }

                    serverTab.call({
                        name: 'Machine' + upperCollectionName + 'List',
                        data: createData(machine),
                        done: done(machine, d),
                        error: done(machine, d)
                    });
                });
                return d.promise;
            }
            function update(machineId, keyToUpdate, item) {
                var d = $q.defer();
                getMachine(machineId, function (machine) {
                    var data = createData(machine, item);
                    data.keyToUpdate = keyToUpdate;
                    serverTab.call({
                        name: 'Machine' + upperCollectionName + 'Update',
                        data: data,
                        done: done(machine, d),
                        error: done(machine, d)
                    });
                });
                return d.promise;
            }
            function remove(machineId, item) {
                var d = $q.defer();
                getMachine(machineId, function (machine) {
                    serverTab.call({
                        name: 'Machine' + upperCollectionName + 'Delete',
                        data: createData(machine, item),
                        done: done(machine, d),
                        error: done(machine, d)
                    });
                });
                return d.promise;
            }
            service[collectionName] = {
                create: create,
                read: read,
                update: update,
                delete: remove
            };
        }

        bindCollectionCRUD('tags');
        bindCollectionCRUD('metadata');

        service.checkFirstInstanceCreated = function (id) {
            return serverTab.call({
                name: 'checkFirstInstanceCreated',
                data: {uuid: id}
            }).promise;
        };

        service.listAllMachines = function () {
            var deferred = $q.defer();
            var pollMachines = function () {
                var machines = service.machine();
                if (machines.final) {
                    deferred.resolve(machines);
                } else {
                    setTimeout(pollMachines, 100);
                }
            };
            pollMachines();
            return deferred.promise;
        };

        service.deleteDockerMachine = function (machine) {
            var machineState = machine.state;
            machine.state = 'deleting';
            handleChunk(machine);
            var job = serverTab.call({
                name: 'DockerDeleteMachine',
                data: {uuid: machine.id,
                    datacenter: machine.datacenter,
                    host: {primaryIp: machine.primaryIp, hostName: machine.name, id: machine.id}},
                progress: function (err, job) {
                    var data = job.__read();
                    if (data && data.length) {
                        PopupDialog.errorObj(data);
                    }
                },
                done: function (err) {
                    if (!err || err.indexOf('getmachine') > -1) {
                        handleChunk(machine, 'delete');
                        machines.list.splice(machines.list.indexOf(machine), 1);
                        $rootScope.$emit('clearDockerCache');
                        delete machines.index[machine.id];
                        showNotification(err, {machine: machine});
                    } else {
                        machine.state = machineState;
                        notification.popup(true, true, INSTANCES_PATH, null, getMessage(machine, err, 'delete'), err.message || err);
                    }
                }
            });

            machine.job = job.getTracker();
            return job.promise;
        };

        service.getTagFilter = function (tag, items) {
            if (tag && items.length) {
                return {
                    name: tag
                };
            }
            return false;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('Machine')));
