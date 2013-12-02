describe('Landing page', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    backend
        .stub(ptor)
        .request('GET', 'cloudAnalytics/ca', {}, {}, new Error())
        .request('GET', 'cloudAnalytics/ca/help', {}, {}, new Error());

    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
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
            // Wait for page load

            driver.wait(function () {
                return driver.getCurrentUrl().then(function (url) {
                    return url.indexOf('/login') !== -1;;
                });
            });

            expect(ptor.params.account.username).not.toBe('');
            expect(ptor.params.account.password).not.toBe('');

            driver.findElement({ name: 'username' }).sendKeys(ptor.params.account.username);
            driver.findElement({ name: 'password' }).sendKeys(ptor.params.account.password);
            driver.findElement({ xpath: '//button[contains(@class,\'submitForm\')]' }).click();
        });

        it('should be logged in', function () {
            ptor.driver.wait(function () {
                return driver.getCurrentUrl().then(function (url) {
                    if(url.indexOf('/login') === url.length - 6) {
                        throw new Error('Incorrect username and password');
                    }
                    return url.indexOf('/main') !== -1;
                });
            });

            driver.getCurrentUrl().then(function (url) {
                expect(url).toContain('/main');
            });
        });
    });
});