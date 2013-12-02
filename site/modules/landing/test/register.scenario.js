var utils = require(process.cwd() + '/lib/utils');

describe('Landing page register', function () {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    backend
        .stub(ptor)
        .request('POST', 'https://sso-westx.piranha.ee/signup', {}, {}, {});


    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
    })

    describe('Register', function() {
        it('should have register link', function() {
            ptor.get('/');
            driver.findElement(protractor.By.xpath('//a[@class="landing-create-account-link"]')).click();
        });
    });

    describe('SSO register', function() {
        it('should allow to register an account', function() {
            driver.wait(function() {
                return driver.getCurrentUrl().then(function(url) {
                    return url.match(/\/signup/);
                });
            });

            driver.findElement(protractor.By.xpath('//input[@placeholder="First name"]')).sendKeys(ptor.params.register.firstName);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Last name"]')).sendKeys(ptor.params.register.lastName);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Company"]')).sendKeys(ptor.params.register.company);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Email"]')).sendKeys(ptor.params.register.email);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Username"]')).sendKeys(ptor.params.register.username);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Password"]')).sendKeys(ptor.params.register.password);
            driver.findElement(protractor.By.xpath('//input[@placeholder="Repeat Password"]')).sendKeys(ptor.params.register.password);

            driver.findElement(protractor.By.xpath('//button[@id="createAccount"]')).click();

            // to go saveToken
            ptor.get('/tfa/saveToken/aHR0cDovLzEyNy4wLjAuMTozMDAwL3NpZ251cC8=/?token=token%22version%22%3A%220.1.0%22%2C%22hash%22%3A%22n%2BHb74NIdIupAd4GA5gU880wxnyILQUm4nlFvsYbuEo%3D%22%7D');
        });
    })
});