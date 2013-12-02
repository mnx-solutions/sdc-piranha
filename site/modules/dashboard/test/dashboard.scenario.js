
describe('Dashboard', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        backend
            .stub(ptor)
            .call('getAccount', backend.data('account'))
            .call('DatacenterList', backend.data('datacenters'))
            .call('MachineList', backend.data('machines'))
            .call('PackageList', [ backend.data('packages') ])
            .call('ImagesList', [ backend.data('datasets') ])
            .call('ZendeskPackagesUpdateTopics', {})
            .call('ZendeskSystemTopics', {})
            .flush();

        ptor.get('/#!/dashboard');
        expect(ptor.getCurrentUrl()).toContain('#!/dashboard');
    });

    it('should have inline frame', function () {
        ptor.findElement(protractor.By.xpath('//iframe[contains(@class,\'dashboard-splash\')]')).isDisplayed();
    });

    it('should redirect to instance provisioning page', function () {
        ptor.findElement(protractor.By.xpath('//body/div[2]/div/div/div/div/div/div[3]/div[1]/div/div[1]/p/a')).click();
        expect(ptor.getCurrentUrl()).toContain('#!/compute/create/');
    });

    it('should redirect to instances list page', function () {
        ptor.findElement(protractor.By.xpath('//body/div[2]/div/div/div/div/div/div[3]/div[1]/div/h4/a')).click();
        expect(ptor.getCurrentUrl()).toContain('#!/compute');
    });

    it('should running machines count', function () {
        ptor.wait(function () {
            return backend.track(ptor).call('MachineList').pending().then(function (isPending) {
                return !isPending;
            });
        }, 10000);

        var runningCount = backend.data('machines').reduce(function (prev, current, index) {
            var count = (typeof(prev) === 'number') ? prev : 0;

            for (var i = 0, c = current.machines.length; i < c; i++) {
                var machine = current.machines[i];
                if (machine.state === 'running') {
                    count++;
                }
            }

            return count;
        });

        ptor.findElement(protractor.By.xpath('//body/div[2]/div/div/div/div/div/div[3]/div[1]/div/div[1]/div[1]')).then(function (elem) {
            expect(elem.getText()).toBe(runningCount + ' Running');
        });

        ptor.wait(function () {
            return backend.track(ptor).call('MachineList').clear();
        });
    });

});