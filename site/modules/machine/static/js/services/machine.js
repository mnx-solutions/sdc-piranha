'use strict';


(function (ng, app) {
    app.factory('Machine', [
        '$resource',
        'serverTab',
        '$rootScope',
        '$q',
        'localization',
        'notification',
        'Package',
        'Dataset',
		'util',
        function ($resource, serverTab, $rootScope, $q, localization, notification, Package, Dataset, util) {

        var service = {};
        var machines = {job: null, index: {}, list: [], search: {}};

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

        service.getSimpleImgList = function(cb) {
            serverTab.call({
                name: 'ImagesSimpleList',
                done: function (err, job) {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    cb(null, job.__read()['images']);
                }
            });
        };

        service.updateMachines = function () {
            if (!machines.job || machines.job.finished) {
                machines.list.final = false;
                machines.job = serverTab.call({
                    name: 'MachineList',
                    progress: function machineProgress(err, job) {
                        var data = job.__read();

                        function handleResponse(chunk) {
                            if(chunk.status === 'error') {

                                notification.push(chunk.name, { type: 'error' },
                                    localization.translate(null,
                                        'machine',
                                        'Unable to retrieve instances from datacenter {{name}}',
                                        { name: chunk.name }
                                    )
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

                    done: function(err, job) {

                        Object.keys(machines.search).forEach(function (id) {
                            if (!machines.index[id]) {
                                machines.search[id].reject();
                            }
                        });

                        machines.list.final = true;
                    }
                });
            }

            return machines.job;
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
                    if (!machine.job || machine.job.finished) {
                        opts.data = opts.data || {};
                        opts.data.uuid = uuid;
                        opts.data.datacenter = machine.datacenter;

                        if (!opts.progress) {
                            opts.progress = function (err, job) {
                                var step = job.step;
                                if (step && typeof step === 'object'){
                                    Object.keys(step).forEach(function (k) {
                                        job.machine[k] = step[k];
                                    });
                                }
                            };
                        }

                        if (!opts.done) {
                            opts.done = function (err, job) {
                                if (err) {
                                    notification.push(job.machine.id, { type: 'error' },
                                        localization.translate(null,
                                            'machine',
                                            'Unable to execute command "{{command}}" for instance {{uuid}}',
                                            {
                                                command: job.name,
                                                uuid: job.machine.id
                                            }
                                        )
                                    );

                                    return;
                                }

                                var result = job.__read();
                                if (result && typeof result === 'object') {
                                    Object.keys(result).forEach(function (k){
                                        job.machine[k] = result[k];
                                    });
                                }
                            };
                        }
                        var job = serverTab.call(opts);
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
                    notification.push(job.machine.id, { type: 'error' },
                        localization.translate(null,
                            'machine',
                            'Unable to execute command "{{command}}" for instance {{uuid}}',
                            {
                                command: job.name,
                                uuid: job.machine.id
                            }
                        )
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
                done: function(err, job) {
                    if (err) {
                        return;
                    }
                },

                error: function(err, job) {
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

            function copy(data) {
                Object.keys(data).forEach(function (k) {
                    machine[k] = data[k];
                });
            }

            function showError(id, instance, err) {
                notification.push(id, { type: 'error' },
                    localization.translate(null,
                        'machine',
                        'Unable to create instance {{name}} ({{uuid}})',
                        {
                            name: (machine.name || ''),
                            uuid: (machine.id || '')
                        }
                    ) +' '+ ((err.message) ? '<br />'+ err.message : '')
                );
            }

            var job = serverTab.call({
                name: 'MachineCreate',
                data: data,
                initialized: function (err, job) {
                    if (err) {
                        showError(id, machine, err);
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
                        showError(id, machine, err);

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

                error: function(err, job) {
                    showError(id, machine, err);

                    machines.list.splice(machines.list.indexOf(machine), 1);
                    delete machines.index[id];
                    return;
                }
            });

            machine.job = job.getTracker();
            return job;
        };

        service.tags = function (id, data) {
            if (!id) {
                return false;
            }

            var m = service.machine(id);

            function tags() {
                if (m.tags) {
                    return m.tags;
                }

                var job = serverTab.call({
                    name: 'MachineTagsList',
                    data: {uuid: id, datacenter: m.datacenter}
                });

                m.tags = job.deferred;
                return m.tags;
            }

            function save() {
                var job = serverTab.call({
                    name: 'MachineTagsSave',
                    data: { uuid: id, tags: data, datacenter: m.datacenter }
                });

                job.deferred.then(function (response) {
                    m.tags = response;
                }, function (err) {
                    notification.push(m.id + '-tags', { type: 'error' },
                        localization.translate(null,
                            'machine',
                            'Unable to save tags'
                        )
                    );
                });

                return job.deferred;
            }

            var d = $q.defer();

            $q.when(m).then(function(machine){
                m = machine;
                d.resolve(data ? save() : tags());
            });

            return d.promise;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('Machine')));
