'use strict';
var instrumentationBlock = {};

// default heatmap values for different requests
var HEATMAP_WIDTH = 580;
var HEATMAP_HEIGHT = 180;
var HEATMAP_NBUCKETS = 25;
var HEATMAP_DURATION = 60;
var HEATMAP_HUES = 21;

module.exports = function execute(scope, app) {

    var info = scope.api('Info');

    function removeBlocked(token, instrs) {
        if (!instrumentationBlock[token]) {
            return {
                valid:instrs,
                blocked:[]
            };
        }

        var ret = {};
        var blocked = {};

        for (var d in instrs) {
            var instr = instrs[d];
            if (!ret[d]) {
                ret[d] = {};
            }

            for (var i in instr) {
                if (i) {
                    if (instrumentationBlock[token].indexOf(i + d) === -1) {
                        ret[d][i] = instr[i];
                    } else {
                        blocked[d][i] = instr[i];
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
            var e = null;
            if (err) {
                req.log.warn(err);
                e = 'Failed to get Cloud Analytics metrics';
            }

            res.json({ err: e, res: resp });
        });
    });

    app.get('/ca/instrumentations', function (req, res) {
        var client = req.cloud;
        var errors = [];
        var response = {
            time:null,
            instrumentations:{}
        };
        var responseCount = 0;

        client.listDatacenters(function(dcerr, dcs) {
            if (dcerr) {
                req.log.warn(dcerr);
                res.json({
                    err: [ 'Failed to get Datacenter list' ],
                    res: response
                });
                return;
            }

            var handleDC = function(client, dcname) {
                client.ListInstrumentations(function (err, resp) {
                    if (!err) {
                        if (resp.length) {
                            var id = resp[0].id;
                            for (var iname in resp) {
                                resp[iname].datacenter = dcname;
                            }

                            // poll the most recent value to sync with ca time.
                            if (!response.time) {
                                client.GetInstrumentationValue(+id, {}, function(err2, value) {
                                    if (!err2) {
                                        response.time = value.start_time;
                                        response.instrumentations[dcname] = resp;
                                    } else {
                                        req.log.warn(err2);
                                        errors.push('Failed to get instrumentation time from ' + dcname);
                                    }

                                    responseCount++;
                                    if(responseCount === Object.keys(dcs).length) {
                                        res.json({
                                            err: errors,
                                            res:response
                                        });
                                        return;
                                    }
                                });
                            } else {
                                responseCount++;
                                response.instrumentations[dcname] = resp;
                            }
                        } else {
                            responseCount++;
                        }

                    } else {
                        responseCount++;
                        req.log.warn(err);
                        errors.push('Failed to get instrumentation list for ' + dcname);
                    }

                    if (responseCount === Object.keys(dcs).length) {
                        res.json({
                            err: errors,
                            res: response
                        });
                        return;
                    }

                });
            }

            for(var dcname in dcs) {2
                var dcClient = client.separate(dcname);
                handleDC(dcClient, dcname);
            }
        })

    });

    app.post('/ca/instrumentations/unblock/:datacenter/:id', function(req, res) {
        if (instrumentationBlock[req.session.token] &&
            instrumentationBlock[req.session.token][req.params.id + req.params.datacenter]) {
            instrumentationBlock[req.session.token]
                .splice(instrumentationBlock[req.session.token]
                .indexOf(req.params.id + req.params.datacenter), 1);
        }

        res.json({});
    });

    app.post('/ca/instrumentations/:datacenter', function (req, res) {
        var client = req.cloud;
        client.setDatacenter(req.params.datacenter);
        client.CreateInstrumentation(req.body, function (err, resp) {
            var e = null;
            if (err) {
                req.log.warn(err);
                e = req.params.datacenter + 'Failed to create instrumentation';
            }

            res.json({ err: e, res: resp });
        });
    });

    app.del('/ca/instrumentations/:datacenter/:id', function(req, res) {
        var token = req.session.token;
        var id = req.params.id;
        var datacenter = req.params.datacenter;
        var name = id + datacenter;

        if (!instrumentationBlock[token]) {
            instrumentationBlock[token] = [];
        }

        instrumentationBlock[token].push(name);
        setTimeout(function(){
            instrumentationBlock[token].splice(instrumentationBlock[token].indexOf(name), 1);
        }, 5000)

        var client = req.cloud;
        client.setDatacenter(datacenter);
        client.DeleteInstrumentation(+id, function (err, resp) {
            var e = null;
            if (err) {
                req.log.warn(err);
                e = 'Failed to delete instrumentation';
            }

            res.json({err:e, res:resp});
        });
    });

    app.post('/ca/getHeatmapDetails/:datacenter/:id', function(req, res) {
        var options = {
            id: +req.params.id,
            ymax: req.body.ymax,
            ymin: req.body.ymin,
            width: req.body.width || HEATMAP_WIDTH,
            height: req.body.height || HEATMAP_HEIGHT,
            nbuckets: req.body.nbuckets || HEATMAP_NBUCKETS,
            duration: req.body.duration || HEATMAP_DURATION,
            ndatapoints: 1,
            end_time: req.body.endtime,
            x: req.body.x,
            y: req.body.y
        };

        var client = req.cloud;
        client.setDatacenter(req.params.datacenter);
        client.getInstrumentationHeatmapDetails(options, options, function (err, resp) {
            var e = null;
            if (err) {
                req.log.warn(err);
                e = 'Failed to get heatmap details';
            }

            res.json({err:e, res:resp});
        });

    });

    var errorC = 0;
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

        for (var i in blocked) {
            response.datapoints[i] = blocked[i];
            response.datapoints[i].blocked = true;
        }

        if (!Object.keys(instrumentations).length){
            res.json(response);
            return;
        }

        var iCount = 0;
        var rCount = 0;
        for (var d in instrumentations) {
            iCount += Object.keys(instrumentations[d]).length;
        }
        for (var datacenter in instrumentations) {
            for (var instrumentationId in instrumentations[datacenter]) {
                var instrumentation = instrumentations[datacenter][instrumentationId];

                (function(instrumentation, instrumentationId, datacenter) {
                    var client = req.cloud;
                    client.setDatacenter(instrumentation.datacenter);

                    var method;
                    var options = {
                        id: instrumentationId
                    };

                    if (instrumentation.ndatapoints) {
                        options.ndatapoints = instrumentation.ndatapoints;
                    } else {
                        options.ndatapoints = opts.ndatapoints || 1;
                    }

                    options.duration = 1;
                    options.start_time = opts.last_poll_time || instrumentation.crtime;

                    switch (instrumentation['value-arity']) {
                        case 'numeric-decomposition':
                            options.width = instrumentation.width || HEATMAP_WIDTH;
                            options.height = instrumentation.height || HEATMAP_HEIGHT;
                            options.nbuckets = instrumentation.nbuckets || HEATMAP_NBUCKETS;
                            options.duration = instrumentation.duration || HEATMAP_DURATION;
                            options.hues = instrumentation.hues || HEATMAP_HUES;
                            options.ndatapoints = 1;
                            options.end_time = options.start_time;
                            delete options.start_time;
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

                    client[method](options, options, function (err, resp) {
                        errorC++;

                        if(!response.datapoints[datacenter]) {
                            response.datapoints[datacenter] = {};
                        }

                        if (!err) {
                            response.datapoints[datacenter][options.id] = resp;
                            response.end_time = resp[resp.length - 1].start_time + 1;

                            if (instrumentation['value-arity'] === 'numeric-decomposition') {
                                response.end_time += instrumentation.duration || HEATMAP_DURATION;
                            }
                        } else {
                            req.log.warn(err);
                            response.datapoints[datacenter][options.id] = {
                                err: 'Failed to get datapoint info'
                            };

                            if (!response.end_time) {
                                response.end_time = options.start_time + options.ndatapoints;
                            }
                        }

                        response.datapoints[datacenter][options.id].blocked = false;
                        rCount++;

                        if (rCount === iCount) {
                            res.json(response);
                        }
                    });

                })(instrumentation, instrumentationId, datacenter);
            }
        }
    });
};