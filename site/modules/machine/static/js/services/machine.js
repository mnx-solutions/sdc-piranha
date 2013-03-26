'use strict';


(function (ng, app) {
    app.factory('Machine', ['$resource', 'serverTab', '$rootScope', '$q', function ($resource, serverTab, $rootScope, $q) {
        var service = {};

        var machines = {job: null, index: {}, list: [], search: {}};

        service.updateMachines = function () {
            if (!machines.job || machines.job.finished) {
                machines.list.final = false;
                machines.job = serverTab.call({
                    name:'MachineList',
                    progress: function (err, job) {
                        var data = job.__read();
                        data.forEach(function(chunk) {
                            chunk.machines.forEach(function (r) {
                                var old = null;
                                if(machines.index[r.id]) {
                                    old = machines.list.indexOf(machines.index[r.id]);
                                }
                                machines.index[r.id] = r;
                                if(machines.search[r.id]) {
                                    machines.search[r.id].resolve(r);
                                    delete machines.search[r.id];
                                }
                                if(old === null) {
                                    machines.list.push(r);
                                } else {
                                    machines.list[old] = r;
                                }
                            });
                        });
                    },
                    done: function(err, job) {
                        if (err) {
                            console.log(err);
                        }
                        machines.list.final = true;
                    }
                });
            }
            return machines.job;
        };

        service.machine = function (id) {
            if (id === true || (!id && (!machines.job || machines.job.finished))) {
                service.updateMachines();
                return machines.list;
            }
            if (!id){
                return machines.list;
            }
            if (!machines.index[id]) {
                service.updateMachines();
            }
            if (!machines.index[id] || (machines.job && !machines.job.finished)) {
                if (!machines.search[id]){
                    machines.search[id] = $q.defer();
                }
                return machines.search[id].promise;
            }
            return machines.index[id];
        };

        // run updateMachines
        service.updateMachines();


        function changeState(opts) {
            return function (uuid) {
                var machine = service.machine(uuid);
                function start() {
                    if (!machine.job || machine.job.finished) {
                        opts.data = opts.data || {};
                        opts.data.uuid = uuid;
                        opts.data.datacenter = machine.datacenter;
                        console.log(machine);
                        if (!opts.progress) {
                            opts.progress = function (err, job) {
                                var step = job.step;
                                if (step && typeof step === 'object'){
                                    Object.keys(step).forEach(function (k) {
                                        job.machine[k] = step[k];
                                    });
                                }
                                if (err) {
                                    //TODO: Error handling
                                    console.log(err);
                                }
                            };
                        }
                        if (!opts.done) {
                            opts.done = function (err, job) {
                                if (err) {
                                    //TODO: Error handling
                                    console.log(err);
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
                    //TODO: Error handling
                    console.log(err);
                }
                delete machines.list[machines.list.indexOf(job.machine)];
                delete machines.index[job.machine.id];
            }
        });

        service.resizeMachine = function (uuid, sdcpackage) {
            var fn = changeState({
                name: 'MachineResize',
                data: {sdcpackage: sdcpackage}
            });
            return fn(uuid);
        };


        service.provisionMachine = function (data) {
            var id = window.uuid.v4();
            var machine = {
                state: 'creating',
                name: data.name,
                id: id
            };

            machines.list.push(machine);
            machines.index[id] = machine;

            function copy(data) {
                Object.keys(data).forEach(function (k) {
                    machine[k] = data[k];
                });
            }

            var job = serverTab.call({
                name: 'MachineCreate',
                data: data,
                initialized: function (err, job) {
                    if (err) {
                        //TODO: Handle error
                        console.log(err);
                    }
                    var index = machines.list.indexOf(machine);
                    delete machines.index[id];
                    machine = job.initial.machine;
                    machine.job = job.getTracker();
                    machines.index[machine.id] = machine;
                    machines.list[index] = machine;
                },
                done: function (err, job) {
                    if (err) {
                        //TODO: Handle error
                        console.log(err);
                    }
                    var result = job.__read();
                    copy(result);
                    machine.datacenter = data.datacenter; //TODO: Should be gotten from server
                },
                progress: function (err, job) {
                    var step = job.step;
                    if (step) {
                        Object.keys(step).forEach(function (k) {
                            machine[k] = step[k];
                        });
                    }
                }
            });
            machine.job = job.getTracker();

            return job;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('Machine')));
