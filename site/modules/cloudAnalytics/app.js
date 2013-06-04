'use strict';
var instrumentationBlock = {};

module.exports = function execute(scope, app) {

    var info = scope.api('Info');

    function removeBlocked(token, isd) {

        if(!instrumentationBlock[token]) {
            return {
                valid:isd,
                blocked:[]
            };
        }

        var ret = {};
        var blocked = {};

        for(var d in isd) {
            var is = isd[d];
            if(!ret[d]) {
                ret[d] = {};
            }
            for(var i in is) {
                if(i) {
                    if(instrumentationBlock[token].indexOf(i + d) === -1) {
                        ret[d][i] = is[i];
                    } else {
                        blocked[d][i] = is[i];
                    }
                }
            }

        }

        return {
            valid: ret,
            blocked: blocked
        };
    }

    app.get('/ca/help', function (req, res) {
        res.json(info.ca_help);
    });

    app.get('/ca', function (req, res) {
        req.cloud.DescribeAnalytics(function (err, resp) {
        if (!err) {
                res.json(resp);
            }
        });
    });

    app.get('/ca/instrumentations', function (req, res) {
        var client = req.cloud;
        var response = {
            time:null,
            instrumentations:[]
        };
        var responseCount = 0;
        client.listDatacenters(function(dcerr, dcs) {
            for(var dcname in dcs) {
                (function(dcname) {
                    client.setDatacenter(dcname);
                    client.ListInstrumentations(function (err, resp) {
                        if (!err) {
                            if(resp.length) {
                                var id = resp[0].id;
                                for(var iname in resp) {
                                    resp[iname].datacenter = dcname;
                                }
                                // poll the most recent value to sync with ca time.
                                if(!response.time) {
                                    client.setDatacenter(dcname);
                                    client.GetInstrumentationValue(+id, {}, function(err2, value) {
                                        if(!err2) {
                                            response.time = value.start_time;
                                            response.instrumentations = response.instrumentations.concat(resp);
                                            responseCount++;
                                            if(responseCount === Object.keys(dcs).length) {
                                                res.json(response);
                                            }
                                        } else {
                                            //TODO: errorhandling
                                        }
                                    });
                                } else {
                                    response.instrumentations = response.instrumentations.concat(resp);
                                    responseCount++;
                                    if(responseCount === Object.keys(dcs).length) {
                                        res.json(response);
                                    }
                                }

                            } else {
                                responseCount++;
                                if(responseCount === Object.keys(dcs).length) {
                                    res.json(response);
                                }
                            }

                        } else {
                            //TODO: errorhandling
                        }
                    });
                })(dcname)
            }
        })

    });

    app.post('/ca/instrumentations/unblock/:datacenter/:id', function(req, res) {

        if (instrumentationBlock[req.session.token] && instrumentationBlock[req.session.token][req.params.id + req.params.datacenter]) {
            instrumentationBlock[req.session.token].splice(instrumentationBlock[req.session.token].indexOf(req.params.id + req.params.datacenter), 1);
        }
        res.json({});
    })

    app.post('/ca/instrumentations/:datacenter', function (req, res) {
        var client = req.cloud;
        client.setDatacenter(req.params.datacenter);
        client.CreateInstrumentation(req.body, function (err, resp) {
            // !TODO: Error handling
            if (!err) {
                res.json(resp);
            } else {
                res.send(500, err);
            }
        });
    });

    app.del('/ca/instrumentations/:datacenter/:id', function(req, res) {
        if(!instrumentationBlock[req.session.token]) {
            instrumentationBlock[req.session.token] = [];
        }

        instrumentationBlock[req.session.token].push(req.params.id + req.params.datacenter);
        setTimeout(function(){
            instrumentationBlock[req.session.token].splice(instrumentationBlock[req.session.token].indexOf(req.params.id + req.params.datacenter), 1);
        }, 5000)
        var client = req.cloud;
        client.setDatacenter(req.params.datacenter);
        client.DeleteInstrumentation(+req.params.id, function (err, resp) {
            if (!err) {
                res.json(resp);
            } else {
                res.send(err);
            }
        });
    });

    app.post('/ca/getHeatmapDetails/:datacenter/:id', function(req, res) {

        var options = {
            id: +req.params.id,
            ymax: req.body.ymax,
            ymin: req.body.ymin,
            width: req.body.width || 580,
            height: req.body.height || 180,
            nbuckets: req.body.nbuckets || 25,
            duration: req.body.duration || 60,
            ndatapoints: 1,
            end_time: req.body.endtime,
            x: req.body.x,
            y: req.body.y
        };
        var client = req.cloud;
        client.setDatacenter(req.params.datacenter);
        console.log('getting heatmap details with options: ',options);
        client.getInstrumentationHeatmapDetails(options, options, function(err, resp) {
            res.json(resp);
        });

    });

    app.post('/ca/getInstrumentations', function(req, res) {

        var opts = req.body.options;
        var instrumentations = opts.individual;
        var response = {
            datapoints:{},
            end_time:null
        };
        var is = removeBlocked(req.session.token, instrumentations);
        instrumentations = is.valid;
        var blocked = is.blocked;

        for(var i in blocked) {
            response.datapoints[i] = blocked[i];
            response.datapoints[i].blocked = true;
        }
        if(!Object.keys(instrumentations).length){
            res.json(response);
            return;
        }

        var iCount = 0;
        var rCount = 0;
        for(var d in instrumentations) {
            iCount += Object.keys(instrumentations[d]).length;
        }
        for(var datacenter in instrumentations) {
            for(var instrumentationId in instrumentations[datacenter]) {
                var instrumentation = instrumentations[datacenter][instrumentationId];
                (function(instrumentation, instrumentationId, datacenter) {

                    var client = req.cloud;
                    client.setDatacenter(instrumentation.datacenter);
                    var method;
                    var options = {
                        id: instrumentationId
                    };

                    if(instrumentation.ndatapoints) {
                        options.ndatapoints = instrumentation.ndatapoints;
                    } else {
                        options.ndatapoints = opts.ndatapoints || 1;
                    }

                    options.duration = 1;

                    options.start_time = opts.last_poll_time || instrumentation.crtime;


                    switch(instrumentation['value-arity']) {
                        case 'numeric-decomposition':
                            options.width = instrumentation.width || 580;
                            options.height = instrumentation.height || 180;
                            options.nbuckets = instrumentation.nbuckets || 25;
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
                        if(!response.datapoints[datacenter]) {
                            response.datapoints[datacenter] = {};
                        }
                        if(!err) {
                            response.datapoints[datacenter][options.id] = resp;
                            response.end_time = resp[resp.length - 1].start_time + 1;
                            if(instrumentation['value-arity'] === 'numeric-decomposition') {
                                response.end_time += instrumentation.duration || 60;
                            }
                        } else {
                            response.datapoints[datacenter][options.id] = {
                                err: err
                            };
                        }
                        response.datapoints[datacenter][options.id].blocked = false;
                        rCount++;
                        if(rCount === iCount) {
                            res.json(response);
                        }
                    });

                })(instrumentation, instrumentationId, datacenter);

            }
        }
    });
};