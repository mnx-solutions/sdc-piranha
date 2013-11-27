// Load e2e configuration
var config = require('easy-config').loadConfig({
    folder: process.cwd() + '/test/e2e/config/'
});

describe('Landing page', function () {
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        ptor.ignoreSynchronization = true;

        driver = ptor.driver;
    });

    describe('Login', function () {
         it('should have login button', function () {
             ptor.get('/');
             ptor.findElement(protractor.By.xpath('//button[contains(@class,\'btn\')]')).click();
         });
    });

    describe('SSO', function () {
        it('should have fields for username and password and submit button', function () {
            expect(driver.getCurrentUrl()).toContain('/login');

            driver.findElement({ name: 'username' }).sendKeys(config.account.username);
            driver.findElement({ name: 'password' }).sendKeys(config.account.password);
            driver.findElement({ xpath: '//button[contains(@class,\'submitForm\')]' }).click();
        });

        it('should redirect to dashboard', function () {
            expect(ptor.getCurrentUrl()).toContain('/dashboard');
            ptor.ignoreSynchronization = false;
        });
    });
});