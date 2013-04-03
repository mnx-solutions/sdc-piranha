'use strict';


module.exports = function (scope, app, callback) {

    var cloud = scope.get('cloud');
    console.log(cloud);
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

        //            resp['uri'] = '/ca/instrumentations/' + resp.id;
        //            for (var i = 0; i < resp['uris'].length; i++ ){
        //                resp['uris'][i].uri = convertUri(resp['uris'][i].uri);
        //            }
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
        console.log('get instrumentations');
//        console.log(arguments);
        var instrumentations = req.body.instrumentations;
        var response = {};
        var client = cloud.proxy();
        console.log(client);
        for(var instrumentationId in instrumentations) {
            var instrumentation = instrumentations[instrumentationId];
            var method;
            var options = {
                id: instrumentation.id
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

            options.ndatapoints = instrumentation.ndatapoints || 1;
            options.duration = instrumentation.duration || 1;
            options.start_time = instrumentation.lastEndTime;// || Math.floor(instrumentation.crtime / 1000);
            console.log(options);
            client[method](instrumentation, options, function(err, resp) {

                if(!err) {
                    response[instrumentation.id] = resp;
                } else {
                    response[instrumentation.id] = {
                        err: err
                    };
                }
                if(Object.keys(response).length === Object.keys(instrumentations).length) {
                    console.log('responding');
                    console.log(response);
                    res.json(response);
                }
            });

        }
    })
//    // get instrumentation values by subject;
//    app.get('/ca/instrumentations/value/:id', function(req, res) {
//        var subject = req.query.subject || req.params.subject;
//        if(!subject) {
//            throw new Error('no subject specified');
//        }
//        switch (subject) {
//            case 'raw':
//                var options = {
//                    id: req.params.id,
//                    ndatapoints: req.query.ndatapoints,
//                    duration: req.query.duration
//                };
//                if(req.query.start_time) {
//                    options.start_time = req.query.start_time;
//                }
//                cloud.proxy().GetInstrumentationValue(options, function(err, resp) {
//                    //expected response is an array
//                    console.log('raw response');
//                    console.log(resp);
//    //                var ret = [resp];
//                    res.json(resp);
//                });
//                break;
//            case 'heatmap':
//                var options = {
//                    id: req.params.id,
//                    ndatapoints: 1, //req.query.ndatapoints,
//                    duration: 1//req.params.duration
////                    height: parseInt(req.params.height),
////                    width: parseInt(req.params.width)
//                };
//                if(req.query.start_time) {
//                    options.start_time = req.query.start_time;
//                }
//                console.log('heatmap');
//                cloud.proxy().GetInstrumentationHeatmap(parseInt(req.params.id), options, function (err, resp) {
//                    console.log('response present object');
//                    console.log(resp[0].present);
//                    if (!err) {
//                        res.json(resp[0]);
//                    }
//                });
//                break;
//            case 'heatmap.image':
//                cloud.proxy().GetInstrumentationHeatmap(parseInt(req.params.id), req.query, function (err, resp) {
//                    if (!err) {
//                        res.json(resp);
//                    }
//                });
//                break;
//            case 'heatmap.details':
//                cloud.proxy().GetInstrumentationHeatmapDetails(parseInt(req.params.id), req.query, function (err, resp) {
//                    if (!err) {
//                        res.json(resp);
//                    }
//                });
//                break;
//            case 'heatmap.average':
//                cloud.proxy().GetInstrumentationHeatmap(parseInt(req.params.id), req.query, function (err, resp) {
//                    if (!err) {
//                        res.json(resp);
//                    }
//                });
//                break;
//            default:
//                throw new Error('subject:' + subject + ' not found');
//        }
//
//    })

    setImmediate(callback);
}