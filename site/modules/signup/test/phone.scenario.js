var utils = require(process.cwd() + '/lib/utils');

describe('Phone verification page', function() {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    //backend
    //    .stub(ptor)
    //    .request('POST', 'https://sso-westx.piranha.ee/signup', {}, {}, {});


    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
    })

    describe('Signup phone step', function() {
        it('should have country select and phone fields plus buttons', function(){
            ptor.wait(function() {
                return ptor.getCurrentUrl().then(function(url) {
                    return url.match(/\/phone/);
                });
            });

            ptor.findElement(protractor.By.xpath('//option[@value=66]')).click();
            ptor.findElement(protractor.By.xpath('//input[@name="phone"]')).sendKeys(ptor.params.register.phone);
        });
    });
});