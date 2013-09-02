describe('MaxMind', function() {
    describe('MaxMindController', function(){
        var scope, ctrl;
        beforeEach(module('JoyentPortal'));
        beforeEach(inject(function ($rootScope, $controller) {
            scope = $rootScope.$new();
            ctrl = $controller('MaxMindController', {$scope: scope});
        }));
        it('basic test', function() {
            expect(2).toBe(2);
        });
    });
});