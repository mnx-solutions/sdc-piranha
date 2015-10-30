'use strict';

(function (app) {
    app.factory('Network', [
        'serverTab',
        '$q',
        'localization',
        'errorContext',
        'Machine',
        'PopupDialog',
        'util',
        'notification',
        function (serverTab, $q, localization, errorContext, Machine, PopupDialog, util, notification) {

            var service = {};
            var networks = {job: {}, index: {}, list: {fabric: false, vlan: []}, error: {}};
            var networksInfo = {};
            var NETWORKS_PATH = '/networks';
            var defaultNetworkCache = {};

            var getMessage = function (network, action) {
                action = action || 'create';
                return 'Unable to ' + action + ' network' + ((network && network.name) ? ' ' + network.name : 's') + '.';
            };

            service.usedNetworks = function () {
                var defer = $q.defer();
                Machine.listAllMachines().then(function (machines) {
                    var usedNetworks = machines.map(function (machine) {
                        return machine.networks;
                    });
                    defer.resolve(util.unique(util.flatten(usedNetworks, true)));
                });
                return defer.promise;
            };

            service.updateNetworks = function (datacenter) {

                networks.job[datacenter] = serverTab.call({
                    name: 'NetworksList',
                    data: {datacenter: datacenter},
                    error: function (err) {
                        networks.error[datacenter] = err;
                    },
                    progress: function (err, job) {
                        var data = job.__read();
                        if (Array.isArray(data)) {
                            data = data[0];
                        }
                        if (err || data.error) {
                            notification.notify('',
                                localization.translate(
                                    null,
                                    'networking',
                                    'Unable to retrieve networks from data center {{name}}.',
                                    {name: data.datacenter}
                                ),
                                err || data.error);
                        }
                    },
                    done: function (err, job) {
                        if (err) {
                            errorContext.emit(new Error(localization.translate(null,
                                'networking',
                                'Unable to retrieve networks list: ' + (err.message || err)
                            )));
                            return;
                        }
                        var result = job.__read();
                        result.forEach(function (network) {
                            networks.index[network.id] = network;
                        });
                        networks.list[datacenter] = result;
                        networks.list[datacenter].final = true;
                    }
                });

                return networks.job[datacenter];
            };

            service.getNetwork = function (datacenter, id) {
                if (typeof datacenter === 'object') {
                    datacenter = datacenter.datacenter;
                    id = datacenter.id;
                }
                var deferred = $q.defer();
                var networkDatacenter = networksInfo[datacenter];

                if (networkDatacenter && networkDatacenter[id]) {
                    deferred.resolve(networkDatacenter[id]);
                } else {
                    serverTab.call({
                        name: 'GetNetwork',
                        data: {id: id, datacenter: datacenter},
                        error: function (err) {
                            deferred.reject(err);
                        },
                        done: function (err, job) {
                            var res = job.__read();

                            if (!networksInfo[datacenter]) {
                                networksInfo[datacenter] = {};
                            }

                            networksInfo[datacenter][id] = res;
                            deferred.resolve(res);
                        }
                    });
                }
                return deferred.promise;
            };

            service.getNetworkConfig = function (datacenters) {
                var job = serverTab.call({
                    name: 'GetNetworkConfig',
                    data: {datacenters: datacenters},
                    done: function (error, job) {
                        var data = job.__read();
                        var defaultNetworks = data.defaultNetworks;
                        if (data.error) {
                            PopupDialog.errorObj(data.error);
                        }
                        if (defaultNetworks && Object.keys(defaultNetworkCache).length) {
                            Object.keys(defaultNetworks).forEach(function (key) {
                                if (defaultNetworks[key] !== defaultNetworkCache[key]) {
                                    defaultNetworks[key] = defaultNetworkCache[key];
                                } else {
                                    delete defaultNetworkCache[key];
                                }
                            });
                        }
                    }
                });
                return job.promise;
            };

            service.updateNetworkConfig = function (datacenter, defaultId) {
                var job = serverTab.call({
                    name: 'UpdateNetworkConfig',
                    data: {id: defaultId, datacenter: datacenter},
                    done: function (error) {
                        if (!error) {
                           defaultNetworkCache[datacenter] = defaultId;
                        }
                    }
                });
                return job.promise;
            };

            service.network = function (datacenter) {
                if (datacenter && !networks.job[datacenter]) {
                    var job = service.updateNetworks(datacenter);
                    return job.promise;
                }

                var deferred = $q.defer();
                if (datacenter && networks.list[datacenter]) {
                    if (networks.list[datacenter].final) {
                        deferred.resolve(networks.list[datacenter]);
                    } else {
                        networks.job[datacenter].promise.then(function () {
                            deferred.resolve(networks.list[datacenter]);
                        });
                    }
                }

                return deferred.promise;
            };

            service.listFabric = function () {
                var deferred = $q.defer();
                $q.all([service.network('fabric'), service.usedNetworks()]).then(function (result) {
                    var usedNetworks = result[1] || [];
                    networks.list.vlan = result[0].filter(function (network) {
                        if (!network.fabric) {
                            network.actionImpossible = true;
                        }
                        networks.index[network.id] = network;
                        return network.fabric || !network.public && usedNetworks.indexOf(network.id) !== -1;
                    });
                    deferred.resolve(networks.list.vlan);
                });
                return deferred.promise;
            };

            service.createNetwork = function (network) {
                var job = serverTab.call({
                    name: 'FabricNetworkCreate',
                    data: network,
                    done: function (err, job) {
                        if (err) {
                            notification.notify('/networks/create', getMessage(network), err);
                        } else {
                            var data = job.__read();
                            if (networks.list.fabric) {
                                data.datacenter = network.datacenter;
                                data.ipRange = data.provision_start_ip ? data.provision_start_ip + '-' + data.provision_end_ip : '';
                                networks.index[data.id] = data;
                                networks.list.vlan.push(data);
                                networks.list.fabric.push(data);
                            }
                        }
                    }
                });
                return job;
            };

            service.getFabricNetwork = function (params) {
                var deferred = $q.defer();
                if (typeof params === 'string') {
                    params = {id: params};
                }

                if (networks.list.fabric.final && networks.index[params.id]) {
                    deferred.resolve(networks.index[params.id]);
                    return deferred.promise;
                } else {
                    service.network('fabric').then(function () {
                        deferred.resolve(networks.index[params.id]);
                    }, deferred.reject);

                    return deferred.promise;
                }
            };

            service.deleteNetworks = function (networksList) {
                var job = serverTab.call({
                    name: 'FabricNetworksDelete',
                    data: networksList,
                    progress: function (err, job) {
                        var data = job.__read();
                        if (Array.isArray(data)) {
                            data = data[0];
                        }
                        if (err || data.error) {
                            notification.notify(NETWORKS_PATH, getMessage(data, 'delete'), err || data.error);
                        } else if (networks.index[data.id]) {
                            networks.list.vlan.forEach(function (network, index) {
                                if (network.id === data.id) {
                                    networks.list.vlan.splice(index, 1);
                                }
                            });
                            delete networks.index[data.id];
                        }
                    },
                    done: function (err) {
                        if (err) {
                            notification.notify(NETWORKS_PATH, getMessage(null, 'delete'), err);
                        }
                        networks.list.fabric = Object.keys(networks.index).map(function (key) {
                            return networks.index[key];
                        });
                    }
                });
                return job;
            };

            return service;
        }]);
}(window.JP.getModule('Networking')));

