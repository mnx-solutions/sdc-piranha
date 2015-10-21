'use strict';
var config = require('easy-config');
var vasync = require('vasync');

module.exports = function execute() {
    var server = require('../server').Server;
    var utils = require('../../../lib/utils');
    var networkingDatacenters = config.networkingDatacenters || [];

    server.onCall('GetNetwork', {
        verify: function (data) {
            return data && typeof data.id === 'string' && data.datacenter;
        },
        handler: function (call) {
            var network = call.data;
            call.cloud.separate(network.datacenter).getNetwork(network.id, call.done.bind(call));
        }
    });

    server.onCall('NetworksList', function (call) {
        var datacenters = call.data.datacenter === 'fabric' ? networkingDatacenters : [call.data.datacenter];
        vasync.forEachParallel({
            inputs: datacenters,
            func: function (datacenter, callback) {
                call.cloud.separate(datacenter).listNetworks(function (err, networks) {
                    if (err) {
                        call.update(null, {status: 'error', error: err, datacenter: datacenter});
                        return callback(null, []);
                    }
                    networks.forEach(function (network) {
                        network.datacenter = datacenter;
                        network.ipRange = network.provision_start_ip ? network.provision_start_ip + '-' + network.provision_end_ip : '';
                    });
                    callback(null, networks);
                });
            }
        }, function (vasyncErrors, operations) {
            var data = utils.getVasyncData(vasyncErrors, operations);
            call.done(data.error, data.result);
        });
    });

    if (!config.features || config.features.networking !== 'disabled') {
        server.onCall('FabricNetworkCreate', {
            verify: function (data) {
                return data && typeof data.datacenter === 'string';
            },
            handler: function (call) {
                var network = call.data;
                network.vlan_id = parseInt(network.vlan_id, 10) || 0;
                call.cloud.separate(network.datacenter).createFabricNetwork(network, call.done.bind(call));
            }
        });

        server.onCall('FabricVlansList', function (call) {
            var cloudapi = call.cloud;
            cloudapi.listDatacenters(function (err, datacenters) {
                if (err) {
                    return call.done(err);
                }

                var availableDatacenters = Object.keys(datacenters).filter(function (datacenter) {
                   return networkingDatacenters.indexOf(datacenter) !== -1;
                });

                if (availableDatacenters.length === 0) {
                    return call.done('Data centers with enabled VLANs not found.');
                }

                vasync.forEachParallel({
                    inputs: availableDatacenters,
                    func: function (datacenter, callback) {
                        cloudapi.separate(datacenter).listFabricVlans(function (err, vlans) {
                            if (err) {
                                call.update(null, {status: 'error', error: err, datacenter: datacenter});
                                return callback(null, []);
                            }
                            vlans.forEach(function (vlan) {
                                vlan.id = datacenter + '&' + vlan.vlan_id;
                                vlan.datacenter = datacenter;
                            });
                            callback(null, vlans);
                        });
                    }
                }, function (vasyncErrors, operations) {
                    var data = utils.getVasyncData(vasyncErrors, operations);
                    call.done(data.error, data.result);
                });
            });
        });

        server.onCall('FabricNetworksDelete', {
            verify: function (data) {
                return data;
            },
            handler: function (call) {
                var networks = call.data;
                if (!Array.isArray(networks)) {
                    networks = [networks];
                }
                vasync.forEachParallel({
                    inputs: networks,
                    func: function (network, callback) {
                        call.cloud.separate(network.datacenter).deleteFabricNetwork(network.vlan_id, network.id, function (err) {
                            if (err) {
                                call.update(null, {status: 'error', error: err});
                                return callback(null, []);
                            }
                            call.update(null, network);
                            callback(null);
                        });
                    }
                }, function (vasyncErrors) {
                    call.done(utils.getVasyncData(vasyncErrors).error);
                });
            }
        });

        server.onCall('FabricVlanCreate', {
            verify: function (data) {
                return data && data.vlan_id && data.datacenter;
            },
            handler: function (call) {
                var vlan = call.data;
                vlan.vlan_id = parseInt(vlan.vlan_id, 10) || 0;
                call.cloud.separate(vlan.datacenter).createFabricVlan(vlan, call.done.bind(call));
            }
        });

        server.onCall('GetFabricVlan', {
            verify: function (data) {
                return data && data.vlan_id && data.datacenter;
            },
            handler: function (call) {
                var vlan = call.data;
                call.cloud.separate(vlan.datacenter).getFabricVlan(vlan.vlan_id, call.done.bind(call));
            }
        });

        server.onCall('FabricVlanUpdate', {
            verify: function (data) {
                return data && data.vlan_id && data.datacenter;
            },
            handler: function (call) {
                var vlan = call.data;
                var options = {name: vlan.name, description: vlan.description};
                call.cloud.separate(vlan.datacenter).updateFabricVlan(vlan.vlan_id, options, call.done.bind(call));
            }
        });

        server.onCall('FabricVlanDelete', {
            verify: function (data) {
                return data && data.vlan_id && data.datacenter;
            },
            handler: function (call) {
                call.cloud.separate(call.data.datacenter).deleteFabricVlan(call.data.vlan_id, call.done.bind(call));
            }
        });
    }
};

