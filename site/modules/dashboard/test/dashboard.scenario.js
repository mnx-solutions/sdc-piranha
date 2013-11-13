
describe('Dashboard', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        backend
            .mock(ptor)
            .call('getAccount', {
                "id": "95793595-8fd6-4434-b802-67c9e8e609b6",
                "login": "harri",
                "email": "harri.s@gmail.com",
                "companyName": "Joyent",
                "firstName": "Harri",
                "lastName": "S",
                "address": "",
                "postalCode": "",
                "city": "",
                "state": "",
                "country": "USA",
                "phone": "54534543543541",
                "tfaEnabled": false
            })
            .call('MachineList', { type: 'error', message: 'Error error!' })
            .request('GET', /^test\/(.*)$/, {}, {}, [ 200 ]);
    });

    it('should have inline frame', function () {
        backend
            .mock(ptor)
            .flush();

        ptor.get('/');

        //ptor.findElement(protractor.By.xpath('//iframe[contains(@class,\'dashboard-splash\')]')).isDisplayed();

        ptor.sleep(50 * 10000);
    });
});