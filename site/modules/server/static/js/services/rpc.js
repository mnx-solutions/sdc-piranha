'use strict';


(function (app) {
  // XXX for debug
  var callHistory = [];

  var calls = {};

  // give reference of internals for debuggin purposes
  app.factory('serverCallInternals', function () {
    return function () {
      return {calls: calls, history: callHistory};
    };
  });

  function handleResults(data, $$track) {

    if (!data || !data.results) {
      return;
    }

    data.results.forEach(function (result) {
      var _call = calls[result.id];
      if (!_call || !_call.progress) {
        return;
      }
      if(!result.finished) {
        _call.progress(result.status);
      } else {
        _call.listener(result.error, result.status);
        _call.job.finished = true;
        _call.job.running = false;
        _call.job.failed = !!result.error;
        _call.job.execCallbacks(_call);

        $$track.timing("Task", _call.name, _call.startTime - new Date().getTime());

        // XXX for debug
        callHistory.push({
          name: _call.name,
          id: _call.id,
          failed: !result.error,
          startTime: _call.startTime,
          endTime: new Date().getTime()
        });
        delete calls[result.id];
      }
    });
  }

  // I provide information about the current route request.
  app.factory('serverCall', ["$http", "$rootScope", "$timeout", "$$track", function ($http, $rootScope, $timeout, $$track) {
    var polling = false;

    // polling function, polls for rpc-call answers
    function pollResults() {
      // if we have unanswered calls
      if (Object.keys(calls).length > 0) {
        // TODO remove timed out calls.
        polling = true;
        // get call results
        $http({timeout: 30000, method: 'get', url: '/server/call'})
          .success(function (data) {
            handleResults(data, $$track);
            $timeout(pollResults, 100);
          })
          .error(function () {
            // TODO handle errors.
            $timeout(pollResults, 1000);
          });
      } else {
        polling = false;
      }
    }

    pollResults();

    // make a serverside rpc call
    return function (name, data, listener, progress) {

      var job = {
        finished: false,
        running: true,
        name: name,
        _callbacks: [],
        addCallback: function (callback) {
          if (callback) {
            this._callbacks.push(callback);
          }
        },
        execCallbacks: function (call) {
          this._callbacks.forEach(function (cb) {
            cb(call);
          });
        }
      };

      var _call = {
        id: uuid.v4(),
        name: name,
        listener: listener,
        progress: progress,
        startTime: new Date().getTime(),
        job: job
      };

      $http.post('/server/call', {name: name, data: data, id: _call.id})
        .success(function () {
          // store call if successful
          calls[_call.id] = _call;

          if (!polling) {
            pollResults();
          }
        })
        .error(function () {
          listener("call failed");
          job.finished = true;
          job.failed = true;
          job.running = false;
          job.execCallbacks();
        });

      return job;
    };
  }]);
}(window.JP.getModule('Server')));
