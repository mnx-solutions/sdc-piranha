// Load e2e configuration
var config = require('easy-config').loadConfig({
    folder: process.cwd() + '/test/e2e/config/'
});
var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
var ptor = null;

var publicKey = {
    name: 'test public key',
    key: 'ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAklOUpkDHrfHY17SbrmTIpNLTGK9Tjom/BWDSU' +
         'GPl+nafzlHDTYW7hdI4yZ5ew18JH4JW9jbhUFrviQzM7xlELEVf4h9lFX5QVkbPppSwg0cda3' +
         'Pbv7kOdJ/MTyBlWXFCR+HAo3FXRitBqxiX1nKhXpHAZsMciLq8V6RjsNAQwdsdMFvSlVK/7XA' +
         't3FaoJoAsncM1Q9x5+3V0Ww68/eIFmb1zuUFljQJKprrX88XypNDvjYNby6vw/Pb0rwert/En' +
         'mZ+AW4OZPnTPI89ZPmVMLuayrD2cE86Z/il8b+gw3r3+1nKatmIkjn2so1d01QraTlMqVSsbx' +
         'NrRFi9wrf+M7Q== example@example.com'
}

describe('Account Billing info', function () {
    var driver = null;
    var sshKeys = 0;

    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
        backend
            .stub(ptor)
            .call('getAccount', backend.data('account'))
            .call('createKey', backend.data('create-key'))
            .call('defaultCreditCard', [backend.data('default-creditcard')])
            .call('listKeys', [backend.data('list-keys')])
            .call('deleteKey', {})
            .flush();
    });
    describe('redirect user to account summary page', function() {
        it('should send user to account summary page', function () {
            ptor.get('/#!/account');
        });
    });

    describe('Summary page', function () {
        it('user should be able to import ssh keys', function () {
            ptor.wait(function() {
                return ptor.getCurrentUrl().then(function(url) {
                    return url.match(/\/account/);
                });
            });
            ptor.findElement(protractor.By.xpath('//button[@class="btn btn-joyent-blue pull-right ssh-add-button"]/span[@class="ng-scope"]')).click();

            ptor.findElement(protractor.By.xpath('//div[@class="modal-body"]/div[1]/div/input')).sendKeys(publicKey.name);
            ptor.findElement(protractor.By.xpath('//div[@class="modal-body"]/div[2]/div/textarea')).sendKeys(publicKey.key);

            ptor.findElement(protractor.By.xpath('//div[@class="modal-footer"]/button[@class="btn ng-scope ng-binding btn-joyent-blue"]')).click();
            var notification = ptor.findElement(protractor.By.xpath('//div[@class="container"]/div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"][1]'));

            expect(notification.getText()).toContain('New key successfully added');

        });
        it('user should be able to delete ssh keys', function () {

            ptor.findElement(protractor.By.xpath('//div[@class="item-list-container"]/div[@class="item row-fluid ng-scope"][1]/span[@class="pointer text-medium"]/span[@class="span12 title ng-binding"]')).click();
            ptor.findElement(protractor.By.xpath('//div[@class="item-list-container"]/div[@class="item row-fluid ng-scope"][1]/div[@class="toolbox span10"]/div[@class="pull-right span2"]/button[@class="btn btn-mini button btn-danger"]/span[@class="ng-scope"]')).click();
            ptor.findElement(protractor.By.xpath('//body[@class="modal-open"]/div[@class="modal ng-scope"]/div[@class="modal-footer"]/button[@class="btn ng-scope ng-binding btn-joyent-blue"]')).click();

            var notification = ptor.findElement(protractor.By.xpath('//div[@class="container"]/div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"][1]'));

            expect(notification.getText()).toContain('Key successfully deleted');
        });

    });
});