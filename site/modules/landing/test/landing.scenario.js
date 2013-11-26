describe('Landing page', function () {
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
    });

    describe('Login', function () {
         it('should have login button', function () {
             ptor.get('/');
             ptor.findElement(protractor.By.xpath('//button[contains(@class,\'btn\')]')).then(function (button) {
                 button.isEnabled();
                 button.click();
             });
         });
    });

    describe('SSO', function () {
        it('should have fields for username and password and submit button', function () {
            expect(driver.getCurrentUrl()).toContain('/login');
            driver.findElement({ name: 'username' }).sendKeys(ptor.params.account.username);
            driver.findElement({ name: 'password' }).sendKeys(ptor.params.account.password);
            driver.findElement({ xpath: '//button[contains(@class,\'submitForm\')]' }).click();
        });
    });
});