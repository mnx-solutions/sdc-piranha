describe('Instances page', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    var ptor = null;
    var driver = null;

    var instances = [];
    var fields = [];

    beforeEach(function() {
        ptor = protractor.getInstance();
        backend
            .mock(ptor)
            .call('DatacenterList', backend.data('datacenters'))
            .call('MachineList', backend.data('machines'))
            .call('PackageList', [ backend.data('packages') ])
            .call('ImagesList', [ backend.data('datasets') ])
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
});