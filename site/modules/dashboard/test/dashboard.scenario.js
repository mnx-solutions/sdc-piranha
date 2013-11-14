
describe('Dashboard', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        backend
            .mock(ptor)
            .call('getAccount', backend.data('account'))
            .call('DatacenterList', backend.data('datacenters'))
            .call('MachineList', backend.data('machines'))
            .call('PackageList', [ backend.data('packages') ])
            .call('ImagesList', [ backend.data('datasets') ])
            .call('ZendeskPackagesUpdateTopics', {})
            .call('ZendeskSystemTopics', {})
            .flush();
    });

    it('should have inline frame', function () {
        ptor.get('/');
        ptor.findElement(protractor.By.xpath('//iframe[contains(@class,\'dashboard-splash\')]')).isDisplayed();
    });
});