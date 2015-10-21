'use strict';

(function (app) {
    app.factory('Vlan', [
        'serverTab',
        '$q',
        'localization',
        'notification',
        'errorContext',
        function (serverTab, $q, localization, notification, errorContext) {

            var service = {};
            var vlans = {job: null, index: {}, list: [], error: {}};
            var VLANS_PATH = '/vlans';

            service.name = {
                pattern: /^[A-Za-z]+[A-Za-z0-9\.\_\/\\-]*$/,
                errorMessage: "Must start with a letter, may contain alphanumeric characters and '_', '\\', '.', '/', '-'."
            };

            var findIndexByVlan = function (list, vlan) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i].id === vlan.id) {
                        return i;
                    }
                }
                return list.length - 1;
            };

            var getMessage = function (vlan, err, action) {
                action = action || 'create';
                var vlanName = vlan && vlan.name ? ' "' + vlan.name + '"' : '';
                return err ? 'Unable to ' + action + ' VLAN' + vlanName + '.' :
                    'VLAN' + vlanName + ' has successfully ' + action + 'd.';
            };

            var updateCache = function (vlan, action) {
                var index = action && findIndexByVlan(vlans.list, vlan);
                if (!action) {
                    vlans.list.push(vlan);
                    vlans.index[vlan.id] = vlan;
                } else if (action === 'delete') {
                    vlans.list.splice(index, 1);
                    delete vlans.index[vlan.id];
                } else if (action === 'update') {
                    vlans.list[index] = vlan;
                    vlans.index[vlan.id] = vlan;
                }
            };

            service.updateVlans = function () {
                if (!vlans.job || vlans.job.finished) {
                    vlans.job = null;
                    vlans.list = [];
                    vlans.job = serverTab.call({
                        name: 'FabricVlansList',
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
                                        'Unable to retrieve VLANs from data center {{name}}.',
                                        {name: data.datacenter}
                                    ),
                                    err || data.error);
                            }
                        },
                        done: function (err, job) {
                            if (err) {
                                errorContext.emit(new Error(localization.translate(null,
                                    'networking',
                                    'Unable to retrieve VLANs list: ' + (err.message || err)
                                )));
                                return;
                            }
                            var result = job.__read();
                            result.forEach(function (vlan) {
                                vlans.index[vlan.id] = vlan;
                            });
                            vlans.list = result;
                            vlans.list.final = true;
                        }
                    });
                }
                return vlans.job;
            };

            service.resetVlan = function (oldVlan, callback) {
                updateCache(oldVlan, 'update');
                callback();
            };

            service.vlan = function (params, updateCache) {
                var deferred = $q.defer();

                if (updateCache) {
                    vlans = {index: {}, job: null, list: {}};
                }

                var filterVlans = function () {
                    if (params) {
                        if (typeof params === 'string' && vlans.index[params]) {
                            deferred.resolve(vlans.index[params]);
                        } else {
                            deferred.reject('VLAN ' + params + ' not found');
                        }
                    } else {
                        deferred.resolve(vlans.list);
                    }
                };

                if (vlans.list.final && !vlans.error && !updateCache) {
                    filterVlans();
                } else {
                    service.updateVlans().promise.then(function () {
                        filterVlans();
                    }, deferred.reject);
                }

                return deferred.promise;
            };

            service.createVlan = function (vlan, path) {
                path = path || '/vlans/create';
                var job = serverTab.call({
                    name: 'FabricVlanCreate',
                    data: vlan,
                    done: function (err) {
                        if (!err) {
                            updateCache(vlan);
                        }
                        notification.notify(path, getMessage(vlan, err), err);
                    }
                });
                return job;
            };

            service.updateVlan = function (vlan) {
                var job = serverTab.call({
                    name: 'FabricVlanUpdate',
                    data: vlan,
                    done: function (err) {
                        if (!err) {
                            updateCache(vlan, 'update');
                        }
                        notification.notify(VLANS_PATH, getMessage(vlan, err, 'update'), err);
                    }
                });
                return job;
            };

            service.deleteVlan = function (vlan) {
                var job = serverTab.call({
                    name: 'FabricVlanDelete',
                    data: {vlan_id: vlan.vlan_id, datacenter: vlan.datacenter},
                    done: function (err) {
                        if (!err) {
                            updateCache(vlan, 'delete');
                        }
                        notification.notify(VLANS_PATH, getMessage(vlan, err, 'delete'), err);
                    }
                });
                return job;
            };

            return service;
        }]);
}(window.JP.getModule('Networking')));
