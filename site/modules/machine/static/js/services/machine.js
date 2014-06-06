'use strict';


(function (ng, app) {
    app.factory('Machine', [
        'serverTab',
        '$rootScope',
        '$q',
        '$timeout',
        'localization',
        'Package',
        'Dataset',
        'util',
        'PopupDialog',
        'Account',
        '$location',

        function (serverTab, $rootScope, $q, $timeout, localization, Package, Dataset, util, PopupDialog, Account, $location) {

        var service = {};
        var machines = {job: null, index: {}, list: [], search: {}};
        var createInstancePageConfig = null;
        if ($rootScope.features.manta === 'enabled') {
            Account.getUserConfig().$child('createInstancePage').$load(function (error, config) {
                createInstancePageConfig = config;
            });
        }
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

        function wrapMachine (machine) {
            var p = null;
            var i = null;
            if(!machine._Package && !machine._Dataset) {
                Object.defineProperties(machine, {
                    _Package: {
                        get: function () {
                            if(!p) {
                                p = {};
                                if(machine.package) {
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
                            if(!i) {
                                i = {};
                                if(machine.image) {
                                    Dataset.dataset(machine.image).then(function (dataset) {
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
            if(ng.isArray(machine.ips)) {
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
            return job.deferred;
        };

        service.updateMachines = function () {
            if (!machines.job || machines.job.finished) {
                machines.list.final = false;
                machines.job = serverTab.call({
                    name: 'MachineList',
                    progress: function (err, job) {

                        var data = job.__read();

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
                                        'Unable to retrieve instances from datacenter {{name}}.',
                                        { name: chunk.name }
                                    ),
                                    function () {}
                                );
                                return;
                            }

                            if(chunk.machines) {
                                chunk.machines.forEach(handleChunk);
                            }
                        }

                        if (ng.isArray(data)) {
                            data.forEach(handleResponse);
                        } else {
                            handleResponse(data);
                        }
                    },

                    done: function(err) {

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

        service.pollMachines = function (timeout) {
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
                    data: { states: mapStates() },

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
                        service.pollMachines(timeout);
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
            service.updateMachines();
        }

        function changeState(opts) {
            return function (uuid) {
                var machine = service.machine(uuid);
                function start() {
                    var stateChanged = true;
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
                                if (step && typeof step === 'object'){
                                    Object.keys(step).forEach(function (k) {
                                        if (!stateChanged || k !== 'state') {
                                            data.machine[k] = step[k];
                                        }
                                    });
                                }
                            };
                        }

                        if (!opts.done) {
                            opts.done = function (err, data) {
                                if (err) {
                                    PopupDialog.error(
                                        localization.translate(
                                            null,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            null,
                                            'machine',
                                            'Unable to execute command "{{command}}" for instance {{uuid}}.',
                                            {
                                                command: data.name,
                                                uuid: data.machine.id
                                            }
                                        ),
                                        function () {}
                                    );

                                    return;
                                }

                                var result = data.__read();
                                if (result && typeof result === 'object') {
                                    Object.keys(result).forEach(function (k){
                                        data.machine[k] = result[k];
                                    });
                                }
                            };
                        }
                        var job = serverTab.call(ng.copy(opts));
                        job.machine = machine;
                        machine.job = job.getTracker();
                    }
                    return machine.job;
                }

                if (machine.id) {
                    return start();
                }

                var d = $q.defer();
                machine.then(function(m) {
                    machine = m;
                    d.resolve(start());
                });

                return d.promise;
            };
        }

        service.startMachine = changeState({ name: 'MachineStart' });

        service.stopMachine = changeState({ name: 'MachineStop' });

        service.rebootMachine = changeState({ name: 'MachineReboot' });

        service.deleteMachine = changeState({
            name: 'MachineDelete',
            done: function(err, job) {
                if (err) {
                    PopupDialog.error(
                        localization.translate(
                            null,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            null,
                            'machine',
                            'Unable to execute command "{{command}}" for instance {{uuid}}.',
                            {
                                command: job.name,
                                uuid: job.machine.id
                            }
                        ),
                        function () {}
                    );

                    return;
                }

                machines.list.splice(machines.list.indexOf(job.machine), 1);
                delete machines.index[job.machine.id];
            }
        });

        service.listFirewallRules = function (uuid) {
            var machine = service.machine(uuid);
            var job = serverTab.call({
                name: 'MachineRuleList',
                data: {
                    machineId: uuid,
                    datacenter: machine.datacenter
                },
                done: function(err) {
                    if (err) {
                        return;
                    }
                }
            });

            //machine.job = job.getTracker();
            return job.deferred;
        };

        service.resizeMachine = function (uuid, sdcpackage) {
            var fn = changeState({
                name: 'MachineResize',
                data: {sdcpackage: sdcpackage.name}
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

            var jobCall = serverTab.call({
                name: 'MachineCreate',
                data: data,
                initialized: function (err, job) {
                    if (err) {
                        showError(machine, err);
                        return;
                    }

                    var index = machines.list.indexOf(machine);
                    delete machines.index[id];
                    machine = job.initial.machine;
                    machine.datacenter = data.datacenter;
                    machine.job = job.getTracker();
                    machines.index[machine.id] = machine;
                    machines.list[index] = machine;
                },

                done: function (err, job) {
                    if (err) {
                        showError(machine, err);

                        machines.list.splice(machines.list.indexOf(machine), 1);
                        delete machines.index[id];
                        return;
                    }

                    var result = job.__read();
                    result.datacenter = data.datacenter;
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
                    if (err.message && err.message.indexOf('QuotaExceeded:') !== 0 || typeof (err) === 'string') {
                        showError(machine, err);
                    }
                    machines.list.splice(machines.list.indexOf(machine), 1);
                    delete machines.index[id];
                }
            });

            machine.job = jobCall.getTracker();
            return jobCall;
        };

            var bindCollectionListUpdate = function (collectionName) {
                var upperCollectionName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
                service[collectionName] = function (id, data) {
                    if (!id) {
                        return false;
                    }
                    var d = $q.defer();

                    var machine = service.machine(id);

                    function list() {
                        if (machine[collectionName]) {
                            d.resolve(machine[collectionName]);
                            return;
                        }
                        
                        if (!machine[collectionName + 'Job']) {
                            machine[collectionName + 'Job'] = serverTab.call({
                                name: 'Machine' + upperCollectionName + 'List',
                                data: {uuid: id, datacenter: machine.datacenter}
                            }).deferred;
                        }

                        machine[collectionName + 'Job'].then(function (result) {
                            machine[collectionName] = result;
                            d.resolve(result);
                        });
                    }

                    function save() {
                        var callData = {uuid: id, datacenter: machine.datacenter};
                        callData[collectionName] = data;
                        var job = serverTab.call({
                            name: 'Machine' + upperCollectionName + 'Save',
                            data: callData
                        });

                        job.deferred.then(function (response) {
                            if (collectionName === 'metadata' && machine[collectionName].credentials) {
                                response.credentials = machine[collectionName].credentials;
                            }
                            machine[collectionName] = response;
                            d.resolve(response);
                        }, function (err) {
                            d.reject(err);
                            PopupDialog.error(
                                localization.translate(null, null, 'Error'),
                                localization.translate(null, 'machine',
                                    'Unable to save ' + collectionName + '.'
                                )
                            );
                        });
                    }

                    $q.when(machine).then(function (updatedMachine) {
                        machine = updatedMachine;
                        if (data) {
                            save();
                        } else {
                            list();
                        }
                    });

                    return d.promise;
                };
            };

        bindCollectionListUpdate('tags');
        bindCollectionListUpdate('metadata');

        service.checkFirstInstanceCreated = function (id) {
            var job = serverTab.call({
                name: 'checkFirstInstanceCreated',
                data: {uuid: id}
            });
            return job.deferred;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('Machine')));
