var utils = require(process.cwd() + '/lib/utils');

describe('Instances page', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

    var ptor = null;
    var driver = null;

    var instances = [];
    var fields = [];

    // Main instance for manipulations
    var instance = utils.clone(backend.data('machines')[3].machines[0]);
    var pkg = utils.clone(backend.data('packages')[0]);

    // Set stub data
    backend
        .stub(protractor.getInstance())
        .call('DatacenterList', backend.data('datacenters'))
        .call('MachineList', backend.data('machines'))
        .call('PackageList', [ backend.data('packages') ])
        .call('ImagesList', [ backend.data('datasets') ])
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
        ]);

    beforeEach(function() {
        ptor = protractor.getInstance();

        backend
            .stub(ptor)
            .flush();
    });

    it('should contain list of instances', function () {
        ptor.get('#!/compute');
        expect(ptor.getCurrentUrl()).toContain('#!/compute');

        // Wait for MachineList call to complete
        ptor.wait(function () {
            return backend.track(ptor).call('MachineList').pending().then(function (isPending) {
                return !isPending;
            });
        }, 10000);

        expect(backend.track(ptor).call('MachineList').pending()).toBeFalsy();
        expect(backend.track(ptor).call('MachineList').calledOnce()).toBeTruthy();
        expect(backend.track(ptor).call('ImagesList').calledOnce(true)).toBeTruthy();
        expect(backend.track(ptor).call('PackageList').calledOnce(true)).toBeTruthy();
        expect(backend.track(ptor).call('PackageList').calledWithParams({ datacenter: null })).toBeTruthy();

        ptor.findElements(protractor.By.repeater('object in objects')).then(function (_instances) {
            expect(_instances).not.toBeNull();
            expect(_instances.length).toEqual(2);

            instances = _instances;
        });
    });

    it('should have correct structure for instances list', function () {
        instances[0].findElements(protractor.By.repeater('prop in props')).then(function (properties) {
            expect(properties.length).toEqual(5);

            properties[0]
                .findElement(protractor.By.tagName('a'))
                .getAttribute('data-ng-switch-when').then(function (value) {
                    expect(value).toEqual('label');
                 });

            properties[0]
                .findElement(protractor.By.tagName('a'))
                .getAttribute('href').then(function (value) {
                    expect(value).toContain('#!/compute/instance/2a4f6f94-f94a-ee65-b486-96705c74aefb');
                });

            properties[1]
                .findElement(protractor.By.tagName('span'))
                .getAttribute('data-ng-switch').then(function (value) {
                    expect(value).toEqual('prop.type');
                });

            properties[2]
                .findElement(protractor.By.tagName('span'))
                .getAttribute('data-ng-switch-when').then(function (value) {
                    expect(value).toEqual('created');
                });

            properties[3]
                .findElement(protractor.By.tagName('span'))
                .getAttribute('data-ng-switch').then(function (value) {
                    expect(value).toEqual('prop.type');
                });

            properties[4]
                .findElement(protractor.By.tagName('span'))
                .getAttribute('data-ng-switch-when').then(function (value) {
                    expect(value).toEqual('state');
                });

            fields = properties;
        });
    });

    it('should navigate to instance details', function () {
        var computeUrl = '#!/compute/instance/2a4f6f94-f94a-ee65-b486-96705c74aefb';

        ptor.get(computeUrl);
        expect(ptor.getCurrentUrl()).toContain(computeUrl);
    });

    it('should able to start instance', function () {
        ptor.wait(function () {
            return backend.track(ptor).call('MachineList').pending().then(function (isPending) {
                return !isPending;
            });
        }, 10000);

        var startButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[1]'));

        startButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        startButton.click();

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();

        startButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeFalsy();
            });

        expect(backend.track(ptor).call('MachineStart').calledOnce()).toBeTruthy();
    });

    it('should able to restart instance', function () {
        var rebootButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[4]'));

        rebootButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        rebootButton.click();

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();

        rebootButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        expect(backend.track(ptor).call('MachineReboot').calledOnce()).toBeTruthy();
    });

    it('should able to stop instance', function () {
        var stopButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[2]'));

        stopButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        stopButton.click();

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();

        stopButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeFalsy();
            });
    });

    it('should able to delete instance', function () {
        var deleteButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[3]'));

        deleteButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        deleteButton.click();

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        backend.data('machines')[3].machines.splice(0, 1); // Remove data
        confirmationButton.click();

        expect(backend.track(ptor).call('MachineDelete').calledOnce()).toBeTruthy();
    });

    it('should remove deleted instance from the instances list', function () {
        ptor.get('#!/compute');
        expect(ptor.getCurrentUrl()).toContain('#!/compute');

        ptor.findElements(protractor.By.repeater('object in objects')).then(function (_instances) {
            expect(_instances).not.toBeNull();
            expect(_instances.length).toEqual(1);

            instances = _instances;
        });
    });

    it('should navigate to instance details', function () {
        var computeUrl = '#!/compute/instance/9cd1d817-cc70-6dab-96be-eb3dd3134a1a';

        ptor.get(computeUrl);
        expect(ptor.getCurrentUrl()).toContain(computeUrl);
    });

    it('should resize instance successfully', function () {
        // Open dropdown
        var resizeDropdown = ptor.findElement(protractor.By.xpath('//*[@id="s2id_autogen1"]/a'));
        resizeDropdown.click();

        // Make selection
        var selectOption = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[2]/select/option[5]'));
        selectOption.click();

        // Push resize button
        var resizeButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[2]/div[2]/button'));

        resizeButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        resizeButton.click();

        // Confirm resize
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[8]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });


        confirmationButton.click();

        // Wait for MachineResize call to complete
        ptor.wait(function () {
            return backend.track(ptor).call('MachineResize').pending().then(function (isPending) {
                return !isPending;
            });
        }, 10000);

        expect(backend.track(ptor).call('MachineResize').calledOnce()).toBeTruthy();

        // Check instance attributes
        ptor.findElement(protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[1]/div/span[1]/span[1]')).then(function (elem) {
            expect(elem.getText()).toContain(pkg.description);
        });
        ptor.findElement(protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[1]/div/span[1]/span[3]')).then(function (elem) {
            expect(elem.getText()).toContain(pkg.group);
        });

        ptor.findElement(protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[1]/div/span[3]')).then(function (elem) {
            expect(elem.getText()).toContain(pkg.memory / 1024);
        });

        ptor.findElement(protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[1]/div/span[5]')).then(function (elem) {
            expect(elem.getText()).toContain(pkg.disk / 1024);
        });

        ptor.findElement(protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[4]/div/fieldset/div/div[1]/div/span[7]')).then(function (elem) {
            expect(elem.getText()).toContain(pkg.vcpus);
        });
    });
});