describe('Signup', function() {
    describe('PhoneController', function(){
        var scope, ctrl;
        beforeEach(module('JoyentPortal'));
        beforeEach(inject(function ($rootScope, $controller) {
            scope = $rootScope.$new();
            var account = new AccountMock();
            var phoneService = new PhoneMock();
            ctrl = $controller('PhoneController', {$scope: scope, Account: account, Phone: phoneService});
        }));
        it('basic test', function() {
            expect(2).toBe(2);
        });
    });
});