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
            ptor.get('/tfa/saveToken/aHR0cDovLzEyNy4wLjAuMTozMDAwL3NpZ251cC8=/?token=%7B%22keyid%22%3A%2239ead1ac-531f-4e7a-85c0-9a56e4181dd7%22%2C%22data%22%3A%22rbTVwh%2BqjdaoXmC4O3kZh13fnW2BsO%2BrIQYDao6CmcAecwuWOWWkTJubdTOD0jNGc1mS%2BQm7FmzLZE%2BDh5IoeoHAyLuN0rNuRNe5txX8JN4rVISNdZMbBnanac1%2FaDnVx1h4yoE10Jis8EJDKVoUIZ%2FY0dIU5EbTUtCaIA3KDyzMTZZ5WPMUr3kICLx8CcAqSmMP6gkZHzCLbrLQGkWVGcMqBci0qIzZWgCCB8sFOv9LR7Rx31nMwyw3ndu2jIBBs1gT7CVs2thl%2BkBvVjStVN%2F0c97tibBDsX6AMI%2FCANZvlLjBV1p8PkwRzLlgSYb40G3ugT9R7YDaR%2FTdVmwfJnmQLBfnzpA%2BHScRVzWLYaPp75iRZ1pP5VNQ1E9%2FNfenCevlOWHJ%2FpFAijF2JxY8mR%2BevFRRYCzkvltYujFgfsf02XVutxVCsDBS%2BZGyBbBcr2m4cLM8mAd7uO2PPv%2BlmCay%2FDLmqywsaovC8QfuulB0iXPcQ%2FIZn76EywnuUxXEIgLyVLR45Zeadrj1n%2BJDI5c4MJVMo1TJX4Btv42yJAYLiQPU%2BibNXBdk%2FMlr3OhJ%2FrNJW1eFAvmH5yobkm4fUm3UetGfB4hMsrjNEZB88h5iQdqPOFCgqzVtJqB5prW7YRzRDVcB%2F4zq89M%2FPaYLynTwOxZZPmhXojZqvzDpMnB%2FcA%2FTQsNQ%2BhQwWoOuP0FaRP3X4%2BFcHJmxLyJKGBI81%2BDuB8IvT5pF1n6BKQ2e%2FYGM1n2k6OU7B2KB2nfXMTcSJOi6JNZc7%2Fa5gpTH27Ohr1V2hxBUcyttrKTMIjmbRNW3k%2BEMmdLRh2sJwu1JAikx%22%2C%22version%22%3A%220.1.0%22%2C%22hash%22%3A%22n%2BHb74NIdIupAd4GA5gU880wxnyILQUm4nlFvsYbuEo%3D%22%7D');
        });
    })
});