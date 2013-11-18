var utils = require(process.cwd() + '/lib/utils');

describe('Instances page', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');

    var ptor = null;
    var driver = null;

    var instances = [];
    var fields = [];

    // Main instance for manipulations
    var instance = utils.clone(backend.data('machines')[3].machines[0]);

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
        .call('MachineReboot', [
            utils.extend(utils.clone(instance), {
                state: 'running',
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
        ptor.sleep(1000);

        expect(ptor.getCurrentUrl()).toContain('#!/compute');

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

    it('first instance should be scheduled for maintenance', function () {
        fields[0]
            .findElement(protractor.By.className('tooltip-hover'))
            .isDisplayed()
            .then(function (displayed) {
            expect(displayed).toBeTruthy();
        });
    });

    it('should have general warning message about upcoming maintenance', function () {
        var element = ptor.findElement(protractor.By.className('alert-warning'));

        element
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        element
            .getText()
            .then(function (text) {
                expect(text).toContain('One or more of your instances are scheduled for maintenance.');
            });
    });

    it('should navigate to instance details', function () {
        var url = '#!/compute/instance/2a4f6f94-f94a-ee65-b486-96705c74aefb';

        ptor.get(url);
        ptor.sleep(1000);

        expect(ptor.getCurrentUrl()).toContain(url);
    });

    it('should have a warning message about upcoming maintenance', function () {
        var element = ptor.findElement(protractor.By.className('alert-warning'));

        element
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        element
            .getText()
            .then(function (text) {
                expect(text).toContain('This instance is scheduled for maintenance on');
            });
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
        ptor.sleep(1000);

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();
        ptor.sleep(1000);

        stopButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeFalsy();
            });
    });

    it('should able to start instance', function () {
        var startButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[1]'));

        startButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        startButton.click();
        ptor.sleep(1000);

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();
        ptor.sleep(1000);

        startButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeFalsy();
            });
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
        ptor.sleep(1000);

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();
        ptor.sleep(1000);

        rebootButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });
    });

    // FIXME: Duplicate code
    it('should able to stop instance (second pass)', function () {
        var stopButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[2]/div/div/div/div/div[3]/div[2]/div[1]/div/button[2]'));

        stopButton
            .isEnabled()
            .then(function (enabled) {
                expect(enabled).toBeTruthy();
            });

        stopButton.click();
        ptor.sleep(1000);

        // Confirmation
        var confirmationButton = ptor.findElement(
            protractor.By.xpath('//html/body/div[6]/div[3]/button[2]'));

        confirmationButton
            .isDisplayed()
            .then(function (displayed) {
                expect(displayed).toBeTruthy();
            });

        confirmationButton.click();
        ptor.sleep(1000);

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
        ptor.sleep(1000);

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
    });
});