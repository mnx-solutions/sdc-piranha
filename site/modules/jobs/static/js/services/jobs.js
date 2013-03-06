'use strict';

(function (app) {
    app.factory('Jobs', function () {
        var jobs = {};

        var Jobs={};

        Jobs.getJobs = function () {
            return jobs;
        };

        Jobs.getJob = function (jobId) {
            return jobs[jobId];
        };

        Jobs.runJob = function (args) {
            var jobObj = {};

            // XXX
            if (args instanceof Array){
                jobOjb.name = args[0];
                jobOjb.task = args[1];
            } else  {
                jobObj = args;
            }

            if (!jobObj.task){
                throw new Error("task is missing");
            }

            var job = {
                id: uuid.v4(),
                startTime: new Date().getTime(),
                job: jobObj,
                name: jobObj.name,
                isFinished: false
            };

            jobs[job.id] = job;

            jobObj.task(function callback(err, result) {
                job.isFinished = true;
                job.endTime = new Date().getTime();
                job.result = result;
                if (err) {
                    job.failed = true;
                    jobObj.onError && jobObj.onError(result);
                } else {
                    jobObj.onSuccess && jobObj.onSuccess(result);
                }
            });

            return job;
        };

        return Jobs;
    });
}(window.JP.getModule('Jobs')));
