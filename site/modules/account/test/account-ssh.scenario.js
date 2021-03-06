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
            .request('POST', 'account/ssh/create/', {}, {}, backend.data('ssh-create'))
            .request('GET', 'account/ssh/job/56527cd9-b9fd-4d2e-8edc-50cce0a9d8c9/', {}, {}, backend.data('ssh-create-job'))
            .call('getAccount', backend.data('account'))
            .call('createKey', backend.data('create-key'))
            .call('listKeys', [backend.data('list-keys')])
            .call('deleteKey', {})
            .flush();

        ptor.get('/#!/account/ssh');
    });

    describe('SSH page', function () {
        it('should be able to import ssh keys', function () {

            ptor.findElement(protractor.By.xpath('//button[@class="btn btn-joyent-blue pull-right ssh-add-button"]/span[@class="ng-scope"]')).click();

            ptor.findElement(protractor.By.xpath('//div[@class="modal-body"]/div[1]/div/input')).sendKeys(publicKey.name);
            ptor.findElement(protractor.By.xpath('//div[@class="modal-body"]/div[2]/div/textarea')).sendKeys(publicKey.key);

            ptor.findElement(protractor.By.xpath('//div[@class="modal-footer"]/button[@class="btn ng-scope ng-binding btn-joyent-blue"]')).click();
            var notification = ptor.findElement(protractor.By.xpath('//div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"]'));

            expect(notification.getText()).toContain('New key successfully added');

        });
        it('should be able to delete ssh keys', function () {

            ptor.findElement(protractor.By.xpath('//div[@class="item-list-container"]/div[@class="item row-fluid ng-scope"][1]/span[@class="pointer text-medium"]/span[@class="span12 title ng-binding"]')).click();
            ptor.findElement(protractor.By.xpath('//div[@class="item-list-container"]/div[@class="item row-fluid ng-scope"][1]/div[@class="toolbox span11"]/div[@class="pull-right span2"]/button[@class="btn btn-mini button btn-danger"]/span[@class="ng-scope"]')).click();
            ptor.findElement(protractor.By.xpath('//body[@class="modal-open"]/div[@class="modal ng-scope"]/div[@class="modal-footer"]/button[@class="btn ng-scope ng-binding btn-joyent-blue"]')).click();

            var notification = ptor.findElement(protractor.By.xpath('//div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"]'));

            expect(notification.getText()).toContain('Key successfully deleted');
        });
        it('should be able to add ssh key', function() {

            ptor.findElement(protractor.By.xpath('//div[@class="new-key-button"]/div/button[@class="btn btn-default pull-right ssh-add-button"]')).click();
            ptor.findElement(protractor.By.xpath('//div[@class="modal-body"]/div[@class="control-group"]/div[@class="controls"]/form[@class="ng-pristine ng-valid"]/input[@class="span5 ng-pristine ng-valid ng-valid-pattern"]')).sendKeys('testkey');
            ptor.findElement(protractor.By.xpath('//div[@class="modal ng-scope"]/div/div[@class="modal-footer"]/button[@class="btn btn-joyent-blue"]')).click();

            var notification = ptor.findElement(protractor.By.xpath('//div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"]'));

            expect(notification.getText()).toContain('SSH key successfully added to your account');
        });
    });
});