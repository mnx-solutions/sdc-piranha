'use strict';

var ursa = require('ursa');
var config = require('easy-config');

module.exports = function execute(scope, register) {
    var api = {};

    var Metadata = scope.api('Metadata');

    function createKeyPairs() {
        var kp = ursa.generatePrivateKey();
        return {
            privateKey: kp.toPrivatePem('utf8'),
            publicKey: kp.toPublicPem('utf8'),
            publicSsh: 'ssh-rsa ' + kp.toPublicSsh('base64') + ' piranha@portal',
            fingerprint: kp.toPublicSshFingerprint('hex').replace(/(.{2})/g, '$1:').slice(0,-1)
        };
    }

    function filterFields(machine) {
        [ 'user-script', 'ufds_ldap_root_dn', 'ufds_ldap_root_pw' ].forEach(function (f) {
            if (machine.metadata[f]) {
                machine.metadata[f] = '__cleaned';
            }
        });

        // Clean null networks
        if (machine.networks) {
            machine.networks = machine.networks.filter(function (network) {
                return !!network;
            });
        }

        return machine;
    }

    function handleCredentials(machine) {
        var systemsToLogins = {
            'mysql' : ['MySQL', 'root'],
            'pgsql' : ['PostgreSQL', 'postgres'],
            'virtualmin' : ['Virtualmin', 'admin']
        };

        var credentials = [];
        if (machine.metadata && machine.metadata.credentials) {
            Object.keys(machine.metadata.credentials).forEach(function (username) {
                var system = systemsToLogins[username] ? systemsToLogins[username][0] : 'Operating System';
                var login = systemsToLogins[username] ? systemsToLogins[username][1] : username;

                credentials.push(
                    {
                        'system' : system,
                        'username' : login.split('_')[0],
                        'password' : machine.metadata.credentials[username]
                    }
                );
            });
        }

        return credentials;
    }

    /**
     * Waits for machine state, package or name change
     * @param {Object} client
     * @param {Object} call - machine ID is taken from call.data.uuid or call.data if it's a string
     * @param {Number} [timeout=300000] - timeout in milliseconds, defaults to 5m
     * @param {String} [state=null]
     * @param {Object} [sdcpackage=null]
     * @param {String} [newName=null]
     */
    function pollForMachineStateChange(client, call, machineId, timeout, state, sdcpackage, newName, callback) {
        var timer = setInterval(function () {
            machineId = machineId ? machineId : (typeof call.data === 'object' ? call.data.uuid : call.data);

            // acknowledge what are we doing to logs
            if (state) {
                call.log.debug('Polling for machine %s to become %s', machineId, state);
            }

            if (sdcpackage) {
                call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage);
            }

            if (newName) {
                call.log.debug('Polling for machine %s to rename to %s', machineId, newName);
            }

            client.getMachine(machineId, true, function (err, machine) {
                if (err) {
                    // in case we're waiting for deletion a http 410(Gone) is good enough
                    if (err.statusCode === 410 && state === 'deleted') {
                        call.log.debug('Machine %s is deleted, returning call', machineId);
                        callback(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                        return;
                    }

                    call.log.error({error:err}, 'Cloud polling failed');
                    call.error(err);
                    clearTimeout(timerTimeout);
                    clearInterval(timer);
                } else if (machine.state === 'failed') {
                    call.log.error('Machine %s fell into failed state', machineId);
                    callback(new Error('Machine fell into failed state'));
                    clearTimeout(timerTimeout);
                    clearInterval(timer);
                } else {
                    // machine state check
                    if (state && state === machine.state) {
                        call.log.debug('Machine %s state is %s as expected, returing call', machineId, state);
                        machine.metadata.credentials = handleCredentials(machine);
                        machine = filterFields(machine);
                        callback(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if (state && state !== machine.state) {
                        call.log.trace('Machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }

                if (!err) {
                    // resize check
                    if (sdcpackage && sdcpackage === machine.package) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage);
                        callback(null, machine);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                    } else if (sdcpackage) {
                        call.log.debug('Machine %s package is %s, waiting for %s', machineId, machine.package, sdcpackage);
                        call.step = { state: 'resizing' };
                    }

                    // name change check
                    if (newName && newName === machine.name) {
                        // make sure machine package didn't go lost
                        if (machine.package === '') {
                            call.log.error('Machine %s package is empty after rename!', machineId);
                        }

                        call.log.debug('Machine %s renamed to %s as expected, returing call', machineId, newName);
                        clearTimeout(timerTimeout);
                        clearInterval(timer);
                        callback(null, machine);

                    } else if (newName) {
                        call.log.debug('Machine %s name is %s, waiting for %s', machineId, machine.name, newName);
                        call.step = { state: 'renaming' };
                    }
                }

            }, null, null, true);
        }, config.polling.machineState);

        // timeout, so we wouldn't poll cloudapi forever
        var timerTimeout = setTimeout(function() {
            call.log.error('Operation timed out');
            clearInterval(timer);
            call.error(new Error('Operation timed out'));
        }, (timeout || 5 * 60 * 1000));
    }

    function updateUserMetadata(call, metadata) {
        Metadata.set(call.req.session.userId, 'portal_private_key', metadata.portal_private_key);
        Metadata.set(call.req.session.userId, 'portal_fingerprint', metadata.portal_fingerprint);

        call.cloud.createKey({name: 'ssc_public_key', key: metadata.ssc_public_key}, function (err, resp) {
            call.log.warn(err);
        });
    }

    api.Create = function (call, options, callback) {
        if (options.elbController) {
            var sscKeyPair = createKeyPairs();
            var portalKeyPair = createKeyPairs();
            var metadata = {
                ssc_private_key: sscKeyPair.privateKey,
                ssc_public_key: sscKeyPair.publicSsh,
                portal_public_key: portalKeyPair.publicSsh,
                account_name: 'dbqp',
                datacenter_name: options.datacenter,
                elb_code_url: 'https://us-east.manta.joyent.com/dbqp/public/elbapi-3.tgz',
                sdc_url: 'https://us-west-1.api.joyentcloud.com',
                manta_user: 'dbqp'
            };
            var metadata = {
                datacenter_name: 'us-west-x',
                sdc_url: 'https://us-west-1.api.joyentcloud.com',
                ssc_private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtbgl5+BBQARk6ZVwijRtns3XSATmjqca9KKGdFnqK4S5WSZF\nZdPWiIOOBgzp4OvwV60GEx64R0AjPSVPQeNkQwUpMAGu4rKv/NdlmpTF5KXC1go1\nH7YaoUYgeCNPSgJO4fcHHCSVyphaeHitvdTW8Z0CJqPCMX9xjaEf3gnqJw0IOHsn\na/Dc97ynu5QpBcHVdCb9G9qFuTlnMwKeCwuSlTtIsg2zwPA9E5Ze4qT7tLAx8yLC\nzVIWYBRLpXXTZE7MMoz70JIT3F/Kobca9d5XCWsSPpEJCqbAMQYHb4nGCqgnwJSv\nvLctg7ECx4uQsuQb7ZvbQBVilyi0+MK3fiub8QIDAQABAoIBACZraJg9sY33X96C\n2ehebU7F9l4jqxs9+VT/h63R1NCenxFaJhIBV7pFFiHxWQFU4NuomUAxnoRx6wFi\ngf9MNEZ3MN4VfQQxA0RRxgmIqs5MvYTDY7fwqHCwguzjij/7fPIJaFdq5MCQtZAC\n87jO5yLuLyY8OTJ932QyTKqFLhxTKdC8verpwTptUPRulEAhmPy61M2duUxDQemQ\nFtFMMj9AEQxt3RWHyek9sWAGrclZPPPj1okqtxSU7KkLX2LSCYl9lwHkdMGwCn59\nnXEFJDoR9LCRMoI+zE6ksWuOfA1WeDMUk3FneMyMSNsrnrgNla189K3kAQ5S4Yw8\nziGsdoECgYEA3D59yWL5U2iftOsS5LB+ol/3lxy0/dvlhUhnGXwmzD3ReDGMlUUZ\n2EGk/JiE1vMwEoSWm2FO1OE2JGIqmGLynNij4leTEkrSPS9QruZ2KBSDF4vKH3tK\nhTYOlL+ZpYm0pCHkL/10Dp+iuCvhN39SUiH4yxMPkk4B4vd02XYmZPsCgYEA0ziJ\nztFACJhNz08JFol6T30OjqKSx4hBSurdulV9Pr1bUu59/LikvcfAaW0nkwTFLfhJ\nvoj1pzL4JO98vM/3ctVYPYv/xSZz56K7CtQ8oasvPqR6lm3ulcfOpwGHVvk3/msE\nVRGJSa4pF6AEU9AEO2bI3In65TsvZTx0/fxLtwMCgYAkgZs5+VTYdXwbceeUzoh/\nA6c3fgOmHH/j4sdsGv8XVZvV72idCXIqPV9Km0FRm8e5Gg8YvD1j3dyqlTb4QVZz\nlxk7GEcBfjNw/tnB0+N760J7calUJIyKnhY2o7elD7lIh3GaXsmQ7vb6zhMrrsgH\nYygpCQTIvHNlmpzcus/MZwKBgAq/msuqfE6zqWn+RKEf99hprb72aO+8cE4mq4fa\n59e0fRw4RLMClmeN7a2vv07M9FfFhcMrZwzOHDCM+1UEZDw0vRvMrwRSU52a+1eu\nuzMi6fGPHyneiECY/VwkSMXVQtMwkPTfQpQ8R50LKI03Ta/UKC6I2vqlS2EkdXOj\nThsPAoGBAM6syMnZlLLZ3H6x7emT3xlAI3bYSP7VPQt8CgHpRQ0ut6goTzoGebgC\njozR884vpMKWESzdJUm/dE+/+4/uKrDvt+boLzK43vOt9CzMGg4eoe6iNGXwh45v\njputcd1nJ5Y8ZbILAcuhOulr8BEV9QF7C3K5wDYsorRlGq0zxPAj\n-----END RSA PRIVATE KEY-----\n',
                ssc_public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC1uCXn4EFABGTplXCKNG2ezddIBOaOpxr0ooZ0WeorhLlZJkVl09aIg44GDOng6/BXrQYTHrhHQCM9JU9B42RDBSkwAa7isq/812WalMXkpcLWCjUfthqhRiB4I09KAk7h9wccJJXKmFp4eK291NbxnQImo8Ixf3GNoR/eCeonDQg4eydr8Nz3vKe7lCkFwdV0Jv0b2oW5OWczAp4LC5KVO0iyDbPA8D0Tll7ipPu0sDHzIsLNUhZgFEulddNkTswyjPvQkhPcX8qhtxr13lcJaxI+kQkKpsAxBgdvicYKqCfAlK+8ty2DsQLHi5Cy5Bvtm9tAFWKXKLT4wrd+K5vx piranha@portal',
                portal_public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDESYgQMAgEembZjy5R8FhdMqV2dtEUhJ+Cl6oZbH26VpU6ZzxpFIUtFN8FuFKJ9z9rd4KqMcs3y2rhw2G3tKBbNWYCo3L7fmjVug5OIbdltUPypgAIg80ypVrmDQb6A14gPE4m/mVH87n0v2sKUgZkXOnb5/rm+Jw/3JdVo500ppOwmWLoEUtVRRbLvR/Scmf5GhnZ6aALxZGxiKsqNDx5yWN8hL3qkv2x3V153lcqyrtI0foWvFDeMX57htqPv6U2OVvccerUZ+y86r5xDuyQcRwV5bJdUKD6R9powZMa6Ch6EqZsDTr/6J3ki8wz/InFmzUWEuTcONRncwEqa8Dt piranha@portal',
                account_name: 'dbqp',
                elb_code_url: 'https://us-east.manta.joyent.com/dbqp/public/elbapi-3.tgz',
                manta_user: 'dbqp',
                root_authorized_keys: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDZyGxUG76NE0Spf3bzedho0603rQPWPGr35qACL0glcCAVL5gNDvtwi+1SpEGD6Fj4AJ7dCvpedvA67OLRBs/hoWwOYnysScjRqeUDv0aV9agjWU6rsAHWg5/Qwbsy91og1yWVoaFA+WDl3uhgIhbQ7xlwi8G+m/FyWLJucnGYEb//Cu6f/x8+gYroFJLHx80Q6AS1VuogFkEHss/MTZvpm02b4udDo6vKj38YEC1kJrUjHLkYNy9oeXtuptDGEgbJETK/4N8N89N93IbzkzU8YkUFkpMiulinQHe0j0IEShmMqqWSleYAJ5bVgOa10mPk0vXU8wqbhWX2qd+i/xCv igor@igorxps\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCvQ5AipRq8EK8wy47hAZnk91g3XPHeOOd8FitVEQcRs4KR+6kdZJxTj20n1Iq/uFPLkQWmUk3G7rw2/Xnmgel//7mGYgqV8ziy7VD/epojwfwDwXmKi5USo+1QedR/wK2Qh0KkA1umZmvseX+Hp48xu6Yjh1do9Epz0DDH9Y1epbIty6RsSQEJD2EvYOpgC1zPLf6jnVBRFb2rKayNxH6XEiZbyaK8llwiH+pfil7b4BnP+tD89emH0dN+cLGkCUicUCQrVDjYtg5/CgRPPCfgIouADiR4BzpDC/w5H8w7HXydBIZyesjyPlqKd8qAbuA+nB+KucyB3wqi4nH4d5RJ piranha@portal\nssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCyeqdQ76YcsY1Djdc6tFVGxqqcUBaGVwzjZ7nP3QkObP1ILPf6A12qDiowkIp99kMQZuN2eSYfhZPXy3jrf7u4GyLK3K/1BJAXf6sTJJSRT3Abwp7cUevhI7cIEthtgqtZPVVImykT6FWKVtv5y7ue3sewpT2FO/swa69uZvhdcfDZroK7XkTbSOg72nwfLBaqYzqvkIJGUyTKLE6Avw5yYOxw2ouYAaQh5yXSx9sWzmCAP1ZO4Nt8uemV66KNp1ls/yyOtunLW7WJ+7dqljkUPG2PuS3nzEa7+AjV542SmZniojULMUlBQcEcHzkzMkw6juCE6xRK2JeqXK5vMAM7 zero@cetku.net\n'
            };
            for (var key in metadata) {
                options['metadata.' + key] = metadata[key];
            }
        }

        call.log.info({options: options}, 'Creating machine %s', options.name);
        call.getImmediate(false);

        var cloud = call.cloud.separate(options.datacenter);
        cloud.createMachine(options, function (err, machine) {
            if (!err) {
                call.immediate(null, {machine: machine});
                //call.data.uuid = machine.id;

                // poll for machine status to get running (provisioning)
                pollForMachineStateChange(cloud, call, machine.id, (60 * 60 * 1000), 'running', null, null, callback);
                if (options.elbController) {
                    metadata.portal_private_key = portalKeyPair.privateKey;
                    metadata.portal_fingerprint = '/' + call.req.session.userName + '/keys/' + portalKeyPair.fingerprint;
                    metadata.portal_fingerprint = '/' + call.req.session.userName + '/keys/95:f2:92:65:c1:78:b4:66:2c:d9:d1:1d:3c:af:de:10';
                    metadata.portal_private_key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAxEmIEDAIBHpm2Y8uUfBYXTKldnbRFISfgpeqGWx9ulaVOmc8\naRSFLRTfBbhSifc/a3eCqjHLN8tq4cNht7SgWzVmAqNy+35o1boOTiG3ZbVD8qYA\nCIPNMqVa5g0G+gNeIDxOJv5lR/O59L9rClIGZFzp2+f65vicP9yXVaOdNKaTsJli\n6BFLVUUWy70f0nJn+RoZ2emgC8WRsYirKjQ8ecljfIS96pL9sd1ded5XKsq7SNH6\nFrxQ3jF+e4baj7+lNjlb3HHq1GfsvOq+cQ7skHEcFeWyXVCg+kfaaMGTGugoehKm\nbA06/+id5IvMM/yJxZs1FhLk3DjUZ3MBKmvA7QIDAQABAoIBAQCVT0nM5nxyy5kI\nzT1y3tyYqDntDxyj+u5LLIsbo8dPwyTotDbjx9Q2IrYzZ66BfC4l1Vbzl8T5wCah\nbTobv65rMwdR4ntIizO7wDe5fzQ+jdAN9+/2iivA5r9qV2aDL6Sd6MGaL9FjFibR\n4fnOc+6g0Xyi5qeYomxYt7f2UOr4bJimUmAtfRckyNsCABBnSSHnZvTQctWCxvMl\nUnkJhSKJYZBWVbqfDbn0msqdV77NKNcdco7BOPkW666tDYunY0/9S1m5Ikc93ouT\nYbEV9O48igda39idEZfqMZhKusBgzRGyQXhFabx8ebnbFXeAO4aD9baQTgCWZ5ON\n3R+scNIBAoGBAOa818wXZszDmwbgoiNl/hhaW/qPaIdbxRoF51EXD03ETkU/2LwW\n7pxbpII/he9JNXrP2nVDkJY4w6WEXSOyteVP5plfVCNKN0/fY7hzmEwXtUAfgj4y\ncVwdu19IM/xdkctsAsluRxPmLGeq14X/x+74YNsQVz8lAEAJp5bQf7XNAoGBANnH\nGwLMfVzvH/zsjEwa0TtC674DSoeuhUD9Ss0k9mhBpp1dUjfoGVWYlekCleI3sR/S\nSkwXonvviU1oUjJUUuYKdTtzdk7xqk9AltZg2Zdn089yzufEMqja8FZrSRG9fodK\nT/qI4vYzun61sSOFt2T3hTB6gSm/+HYvPuNO2RehAoGBAI3XyVFNkYSPOt4feY0J\nRgrygVimkDulzqUQvAK9ikrkQrmPZk06S7UTIS5wnoVbG+VDoag0wM2YV62IkTlA\nw1EUrU3brH2FQjt3uHXLmfQtHt8sf4R8vfNC08zfNhYN73J+E7iAcnFpLiMMgzF8\n7Aub5O7GPNw0gtLbHIs54UiBAoGAR8J24Q42xNe6p6HefPldNnTPr1XwShM0r3yH\nGF/0ndf8KeBlRizBpFXaF+SVNOx6/exSNQ6YqNP+XzZf11u30Tti88sREeRJ5UF4\nMn3JVT2OKs4+5VneA4vZI/DILANP3Q6cmgZfGxdifXwrOXRHQQrapWXIh9RM78yT\noV0K5eECgYBktmQ0IZTqfEYNQr8VBYq57M3/2M+Y6UImPefTELFG/iWk3A18wM1S\n5Q1GNZOc2LbMEz8o/D8/2XLxbY4ZRsr+33qsIXojUHmc2cNhcDR5kYWoFR7lGY5r\nF6w2oBBL3FZFLTcDTm7yql1yJgE1ly+2WKkMuuErKQufRBFkbuKNjg==\n-----END RSA PRIVATE KEY-----\n';
                    updateUserMetadata(call, metadata);
                }
            } else {
                call.log.error(err);
                call.immediate(err);
            }
        });
    };

    api.Rename = function (call, options, callback) {
        var cloud = call.cloud.separate(options.datacenter);
        cloud.renameMachine(options.uuid, options, function(err) {
            if(!err) {
                // poll for machine name change (rename)
                pollForMachineStateChange(cloud, call, options.uuid, (60 * 60 * 1000), null, null, options.name, callback);
            } else {
                call.log.error(err);
                call.done(err);
            }
        });
    };

    api.Resize = function (call, options, callback) {
        call.log.info('Resizing machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.resizeMachine(options.uuid, options, function (err) {
            if (!err) {
                // poll for machine package change (resize)
                pollForMachineStateChange(cloud, call, options.uuid, null, null, options.package, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Start = function (call, options, callback) {
        call.log.debug('Starting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.startMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'running', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Stop = function (call, options, callback) {
        call.log.debug('Stopping machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.stopMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'stopped', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Delete = function (call, options, callback) {
        call.log.debug('Deleting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.deleteMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'deleted', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.Reboot = function (call, options, callback) {
        call.log.debug('Rebooting machine %s', options.uuid);
        var cloud = call.cloud.separate(options.datacenter);
        cloud.rebootMachine(options.uuid, function (err) {
            if (!err) {
                pollForMachineStateChange(cloud, call, options.uuid, null, 'running', null, null, callback);
            } else {
                call.log.error(err);
                call.error(err);
            }
        });
    };

    api.List = function (call, callback) {
        call.log.info('Handling machine list event');

        var datacenters = call.cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            var cloud = call.cloud.separate(name);
            call.log.debug('List machines for datacenter %s', name);

            var allMachines = [];

            cloud.listMachines({ credentials: true }, function (err, machines) {
                var response = {
                    name: name,
                    status: 'pending',
                    machines: []
                };

                if (err) {
                    call.log.error('List machines failed for datacenter %s, url %s; err.message: %s', name, datacenters[name], err.message, err);
                    response.status = 'error';
                    response.error = err;
                } else {
                    machines = machines.filter(function (el) {
                        return el.state !== 'failed';
                    });

                    machines.forEach(function (machine, i) {
                        machine.datacenter = name;
                        machine.metadata.credentials = handleCredentials(machine);
                        machines[i] = filterFields(machine);

                        if (info.instances && info.instances.data[machine.id]) {
                            machines[i] = utils.extend(machines[i], info.instances.data[machine.id]);
                        }

                        allMachines.push(machine);
                    });

                    response.status = 'complete';
                    response.machines = machines;

                    call.log.debug('List machines succeeded for datacenter %s', name);
                }

                call.update(null, response);

                if (--count === 0) {
                    call.done(null, allMachines);
                }
            });
        });
    }

    register('Machine', api);
};
