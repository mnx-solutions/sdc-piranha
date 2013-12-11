var utils = require(process.cwd() + '/lib/utils');

describe('Phone verification page', function() {
    var backend = require(process.cwd() + '/test/e2e/mocks/backend.js');
    var ptor = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        backend
            .stub(ptor)
            .flush();
    });


    describe('redirect user to signup phone step', function() {
        it('should send user to signup phone step', function() {
            ptor.get('/main/account/setStep/phone');
        });
    });

    describe('Signup phone step', function() {
        it('should have country select and phone fields plus buttons', function(){
            ptor.wait(function() {
                return ptor.getCurrentUrl().then(function(url) {
                    return url.match(/\/phone/);
                });
            });

            ptor.findElement(by.xpath('//option[@value=66]')).click();

            ptor.findElement(by.xpath('//input[@name="phone"]')).clear();
            ptor.findElement(by.xpath('//input[@name="phone"]')).sendKeys('1234567890');
            ptor.findElement(by.xpath('//div[@class="container"]/form/div[@class="row"]/div[@class="span3"][2]/button')).isEnabled();

            ptor.findElement(by.xpath('//input[@data-ng-model="pin"]')).sendKeys('1234');
            ptor.findElement(by.xpath('//div[@class="container"]/form[2]/div[@class="row"]/div[@class="span6"]/button'));
        });
    });
});