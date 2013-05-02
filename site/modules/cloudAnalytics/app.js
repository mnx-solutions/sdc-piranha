'use strict';


module.exports = function (scope, app, callback) {

    //    console.log(cloud);
    //convert ca call uri to cloudApi call uri
    function convertUri(uri) {
        return '/ca' + uri.substring(uri.indexOf('/instrumentations'));
    }

    app.get('/ca', function (req, res) {
        req.cloud.DescribeAnalytics(function (err, resp) {
        if (!err) {
                res.json(resp);
            }
        });
    });

    app.get('/ca/instrumentations', function (req, res) {

        req.cloud.ListInstrumentations(function (err, resp) {
            if (!err) {
                console.log(err);

                if(resp.length) {
                    var id = resp[0].id;

                    // poll the most recent value to sync with ca time.
                    req.cloud.GetInstrumentationValue(+id, {}, function(err2, value) {
                        if(!err2) {
                            res.json({
                                time: value.start_time,
                                instrumentations: resp
                            });
                        }
                    });

                } else {
                    res.json({
                        time:null,
                        instrumentations:[]
                    });
                }


            }
        });
    });

    app.post('/ca/instrumentations', function (req, res) {
        req.cloud.CreateInstrumentation(req.body, function (err, resp) {
            // !TODO: Error handling
            console.log(resp);
            if (!err) {
                res.json(resp);
            }
        });
    });

    app.del('/ca/instrumentations/:id', function(req, res) {
        req.cloud.DeleteInstrumentation(+req.params.id, function (err, resp) {
            if (!err) {
                res.json(resp);
            }
            res.send(err);
        });
    });

    app.post('/ca/getInstrumentations', function(req, res) {

        var opts = req.body.options;
        var instrumentations = opts.individual;
        var response = {
            datapoints:{},
            end_time:null
        };


        for(var instrumentationId in instrumentations) {
            (function() {
                var instrumentation = instrumentations[instrumentationId];
                var client = req.cloud;
                var method;
                var options = {
                    id: instrumentationId
                };
                options.ndatapoints = opts.ndatapoints || 1;
                options.duration = 1;

                options.start_time = opts.last_poll_time || instrumentation.crtime;

                switch(instrumentation['value-arity']) {
                    case 'numeric-decomposition':
                        options.width = instrumentation.width || 640;
                        options.height = instrumentation.height || 200;
                        options.nbuckets = instrumentation.nbuckets || 50;
                        options.duration = instrumentation.duration || 60;
                        options.hues = instrumentation.hues || 21;
                        options.ndatapoints = 1;
                        options.end_time = options.start_time;
                        delete options.start_time;
                        //options.start_time = options.start_time - options.duration;
                        method = 'GetInstrumentationHeatmap';
                        break;
                    case 'scalar':
                        method = 'GetInstrumentationValue';
                        break;
                    case 'discrete-decomposition':
                        method = 'GetInstrumentationValue';
                        break;
                    default:
                        method = 'GetInstrumentationValue';
                        break;
                }

                client[method](options, options, function(err, resp) {
                    if(!err) {
                        response.datapoints[options.id] = resp;
                        response.end_time = resp[resp.length - 1].start_time + 1;
                        if(instrumentation['value-arity'] === 'numeric-decomposition') {
                            response.end_time += instrumentation.duration || 60;
                        }
                    } else {
                        response.datapoints[options.id] = {
                            err: err
                        };
                    }


                    if(Object.keys(response.datapoints).length === Object.keys(instrumentations).length) {
                        res.json(response);
                    }
                });
            })();
        }
    });

    setImmediate(callback);
};