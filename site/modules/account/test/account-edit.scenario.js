// Load e2e configuration
var config = require('easy-config').loadConfig({
    folder: process.cwd() + '/test/e2e/config/'
});
var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
var ptor = null;

var accountInfo = {
    email: 'user@user.com',
    firstName: 'firstname',
    lastName: 'lastname',
    companyName: 'company',
    phone: '324542353425'
}
describe('Account Billing info', function () {
    var driver = null;
    var sshKeys = 0;
    var handlePromise = false;
    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
        backend
            .stub(ptor)

            .flush();

        ptor.get('/#!/account/edit');
    });

    describe('Edit page', function () {

        it('should have working SSO change password link', function() {

            ptor.findElement(protractor.By.xpath('//div[@class="span7 pull-right"]/fieldset[1]/a[@class="btn pull-right"]/span[@class="ng-scope"]')).click()

            handlePromise = ptor.getAllWindowHandles();

            handlePromise.then(function(handles) {

                var a = driver.switchTo().window(handles[1])
                expect(driver.getCurrentUrl()).toContain('changepassword');
                driver.close();
                driver.switchTo().window(handles[0]);

            });
        })
        it('should be able to enable tfa', function(){
            ptor.findElement(protractor.By.xpath('//div[@class="span7 pull-right"]/fieldset[2]/button[@class="btn btn-joyent-blue pull-right"]/span[@class="ng-scope"]')).click()

            ptor.findElement(protractor.By.xpath('//input[@id="otpass"]')).sendKeys("random")
            ptor.findElement(protractor.By.xpath('//div[@class="span7 pull-right"]/fieldset[2]/div[1]/button[@class="btn btn-joyent-blue pull-right"]/span[@class="ng-scope"]')).click()
            var button = ptor.findElement(protractor.By.xpath('//div[@class="span7 pull-right"]/fieldset[2]/button[@class="btn btn-danger pull-right"]/span[@class="ng-scope"]'))

            expect(button.getText()).toContain('Disable');
        })
        it('should be able to edit Account info', function () {
            var email = ptor.findElement(protractor.By.xpath('//div[@class="controls"]/input[@id="email"]'))
            var firstName = ptor.findElement(protractor.By.xpath('//div[@class="controls"]/input[@id="firstName"]'))
            var lastName = ptor.findElement(protractor.By.xpath('//div[@class="controls"]/input[@id="lastName"]'))
            var company = ptor.findElement(protractor.By.xpath('//div[@class="controls"]/input[@id="companyName"]'))
            var phone = ptor.findElement(protractor.By.xpath('//div[@class="controls"]/div[@class="input-prepend"]/input'))
            var submit = ptor.findElement(protractor.By.xpath('//fieldset[@class="span5"]/button[@class="btn btn-joyent-blue pull-right"]'))

            email.clear();
            firstName.clear();
            lastName.clear();
            company.clear();
            phone.clear();

            email.sendKeys(accountInfo.email);
            firstName.sendKeys(accountInfo.firstName);
            lastName.sendKeys(accountInfo.lastName);
            company.sendKeys(accountInfo.companyName);
            phone.sendKeys(accountInfo.phone);

            submit.click();
            var notification = ptor.findElement(protractor.By.xpath('//div[@class="alert ng-scope alert-success"]/div/div[@class="ng-scope ng-binding"]'));

            expect(notification.getText()).toContain('Account updated');

        });
    });
});