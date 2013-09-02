var MaxMindMock = function () {
    var self = this;
    inject(function ($q) {
        self.getCountries = function () {
            var q = $q.defer();
            q.resolve({});
            return q.promise;
        };
        self.makeCall = function () {
            var q = $q.defer();
            q.resolve({});
            return q.promise;
        };
        self.verify = function () {
            var q = $q.defer();
            q.resolve({});
            return q.promise;
        };
    });
};