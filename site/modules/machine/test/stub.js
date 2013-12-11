var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
var utils = require(process.cwd() + '/lib/utils');

var instance = utils.clone(backend.data('machines')[3].machines[0]);
var pkg = utils.clone(backend.data('packages')[0]);

// Set stub data
backend
    .stub(null)
    .call('DatacenterList', backend.data('datacenters'))
    .call('MachineList', backend.data('machines'))
    .call('PackageList', [ backend.data('packages') ])
    .call('DatasetList', [ backend.data('datasets') ])
    .call('MachineStop', [
        [
            {
                step: {
                    state: 'running'
                }
            }
        ],

        utils.extend(utils.clone(instance), {
            state: 'stopped',
            step: {
                state: 'stopped'
            }
        })
    ])
    .call('MachineStart', [
        [
            {
                step: {
                    state: 'stopped'
                }
            }
        ],

        utils.extend(utils.clone(instance), {
            state: 'running',
            step: {
                state: 'running'
            }
        })
    ])
    .call('MachineDelete', [
        utils.extend(utils.clone(instance), {
            state: 'deleted'
        })
    ])
    .call('MachineReboot', [
        utils.extend(utils.clone(instance), {
            state: 'running'
        })
    ])
    .call('MachineResize', [
        [
            {
                step: {
                    state: 'resizing'
                }
            }
        ],

        utils.extend(utils.clone(instance), {
            package: pkg.name,
            state: 'running',
            step: {
                state: 'resizing'
            }
        })
    ])
    .call('MachineTagsList', backend.data('tags'))
    .call('MachineTagsSave', backend.data('tags'));