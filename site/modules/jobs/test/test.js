describe("Jobs service", function () {

    beforeEach(function () {
        // load module
        module('Jobs');

        inject(function ($injector) {
            Jobs = $injector.get('Jobs');
        });
    });

    it('should provide way to run tasks', function () {

        var success = false;
        var error = false;

        var job = {
            name: "test job",
            task: function (cb) {
                cb(null, 5);
            },
            onError: function (err) {
                error = true;
            },
            onSuccess: function (result) {
                success = true;
            }};

        expect(success).toBe(false);
        var jobRef = Jobs.runJob(job);
        expect(jobRef.isFinished).toBeTruthy();
        expect(success).toBe(true);
        expect(error).toBe(false);
    });


    it('should work with tasks without handler functions', function () {

        var success = false;

        var job = {
            task: function (cb) {
                cb(null, 5);
            }
           };

        var jobRef = Jobs.runJob(job);
    });
});