// Load e2e configuration
var config = require('easy-config').loadConfig({
    folder: process.cwd() + '/test/e2e/config/'
});
var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
var ptor = null;

describe('Account Billing info', function () {
    var ptor = null;
    var driver = null;

    var billing = {
        creditCardNumber: '4716702602675363',
        expirationMonth: '10',
        expirationYear: '2019',
        securityCode: '234',
        firstName: 'Firstname',
        lastName: 'Lastname',
        addressLine1: 'Address',
        country: 'ET',
        city: 'Tallinn',
        zipCode: '13911'
    }
    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;

        backend
            .stub(ptor)
            .call('defaultCreditCard', {})
            .call('updateAccount', {})
            .flush();

        ptor.get('/#!/account/payment');
    });

    describe('Edit account billing info', function () {
        it('should not have phone input', function () {
            expect(ptor.isElementPresent(protractor.By.id('phone'))).toBeFalsy();
        });

        it('should work without validation errors', function () {

            ptor.findElement(protractor.By.xpath('//form[@id="paymentForm"]/table[1]/tbody/tr[1]/td[2]/div[@class="controls"]/input[@id="creditCardNumber"]')).sendKeys(billing.creditCardNumber);
            ptor.findElement(protractor.By.xpath('//form[@id="paymentForm"]/table[1]/tbody/tr[2]/td[2]/div[@class="controls"]/select[@id="expirationMonth"]')).sendKeys(billing.expirationMonth);
            ptor.findElement(protractor.By.xpath('//form[@id="paymentForm"]/table[1]/tbody/tr[2]/td[2]/div[@class="controls"]/select[@id="expirationYear"]')).sendKeys(billing.expirationYear);
            ptor.findElement(protractor.By.xpath('//form[@id="paymentForm"]/table[1]/tbody/tr[3]/td[2]/div[@class="controls"]/input[@id="securityCode"]')).sendKeys(billing.securityCode);

            ptor.findElement(protractor.By.xpath('//input[@id="addressLine1"]')).sendKeys(billing.addressLine1);
            ptor.findElement(protractor.By.xpath('//select[@id="country"]')).sendKeys(billing.country);
            ptor.findElement(protractor.By.xpath('//input[@id="city"]')).sendKeys(billing.city);
            ptor.findElement(protractor.By.xpath('//input[@id="zipCode"]')).sendKeys(billing.zipCode);

            ptor.findElement(protractor.By.xpath('//form[@id="paymentForm"]/div[2]/button[@class="pull-right btn btn-joyent-blue ng-binding"]')).click();

            var notification = ptor.findElement(protractor.By.xpath('//div[@class="notification-wrapper"]/div[@class="ng-scope"]/div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"]'));

            expect(notification.getText()).toContain('Billing information updated');
        });
    });
});