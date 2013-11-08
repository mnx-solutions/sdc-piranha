describe('Dashboard', function () {
    var ptor = null;
    var driver = null;

    beforeEach(function() {
        ptor = protractor.getInstance();
        driver = ptor.driver;
    });

    it('should have inline frame', function () {
        ptor.findElement(protractor.By.xpath('//iframe[contains(@class,\'dashboard-splash\')]')).isDisplayed();
    });
});