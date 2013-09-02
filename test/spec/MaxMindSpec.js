describe('MaxMind', function() {
    describe('MaxMindController', function(){
        var scope, ctrl;
        beforeEach(module('JoyentPortal'));
        beforeEach(inject(function ($rootScope, $controller) {
            scope = $rootScope.$new();
            var account = new AccountMock();
            var maxMindService = new MaxMindMock();
            ctrl = $controller('MaxMindController', {$scope: scope, Account: account, MaxMind: maxMindService});
        }));
        it('basic test', function() {
            expect(2).toBe(2);
        });
    });
});