'use strict';


module.exports = function (scope, app, callback) {

    var cloud = scope.get('cloud');
//    console.log(cloud);
    //convert ca call uri to cloudApi call uri
    function convertUri(uri) {
        return '/ca' + uri.substring(uri.indexOf('/instrumentations'));
    }

    app.get('/ca', function (req, res) {
        console.log(cloud);
        cloud.proxy().DescribeAnalytics(function (err, resp) {
        if (!err) {
                res.json(resp);
            }
        });
    });

    app.get('/ca/instrumentations', function (req, res) {
        cloud.proxy().ListInstrumentations(function (err, resp) {
        if (!err) {
                res.json(resp);
            }
        });
    });

    app.post('/ca/instrumentations', function (req, res) {
        console.log('create request');
        var client = cloud.proxy();
        console.log(client);
        client.CreateInstrumentation(req.body, function (err, resp) {
            console.log(resp);
            if (!err) {
                res.json(resp);
            }
        });
    });

    app.del('/ca/instrumentations/:id', function(req, res) {
        cloud.proxy().DeleteInstrumentation(+req.params.id, function (err, resp) {
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
        var client = cloud.proxy();

        for(var instrumentationId in instrumentations) {
            var instrumentation = instrumentations[instrumentationId];
            var method;
            var options = {
                id: instrumentationId
            };

            switch(instrumentation['value-arity']) {
                case 'numeric-decomposition':
                    options.width = instrumentation.width || 600;
                    options.height = instrumentation.height || 250;
                    options.nbuckets = instrumentation.nbuckets || 25;
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

            options.ndatapoints = opts.ndatapoints || 1;
            options.duration = 1;
            options.start_time = opts.last_poll_time || instrumentation.crtime;

            client[method](options, options, function(err, resp) {

                if(!err) {
                    response.datapoints[instrumentationId] = resp;
                    response.end_time = resp[resp.length - 1].end_time;
                } else {
                    response.datapoints[instrumentationId] = {
                        err: err
                    };
                }
                if(Object.keys(response.datapoints).length === Object.keys(instrumentations).length) {
                    console.log('responding');
                    console.log(response);
                    res.json(response);
                }
            });

        }
    })

    setImmediate(callback);
}