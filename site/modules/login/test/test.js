

describe("Login service", function () {

    beforeEach(function () {
        // load module
        module('Login');

        inject(function ($injector) {
            $httpBackend = $injector.get('$httpBackend');
            Login = $injector.get('Login');
        });
    });

    it('creates a POST request to /login url with credentials provided', function () {
        var credentials = {username:"test", password:"testpw"}

        $httpBackend.when('POST', '/login').respond({success:true});
        $httpBackend.expectPOST('/login', credentials);

        Login.try(credentials,function (user){
            expect(user.success).toEqual(true);
        });
        $httpBackend.flush();
    });

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });
});