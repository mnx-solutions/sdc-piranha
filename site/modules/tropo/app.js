'use strict';

var tropo_webapi = require('tropo-webapi-node');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host, {auth_pass: config.redis.password});

var http = require('http');
var parseXml = require('xml2js').parseString;


module.exports = function execute(scope, app) {

    function makeTropoCall(randomNumber, retries, req, res) {

        var options = {
            host:'api.tropo.com',
            path: '/1.0/sessions?action=create&token='+ config.tropo.token +'&numberToDial='+ req.params.number +'&randomNumber='+ randomNumber
        };

        var response = res;

        var req = http.get(options, function(res) {
            var resultBody;
            res.on('data', function(chunk) {
                resultBody = chunk;
            });

            res.on('end', function() {
                parseXml(resultBody.toString(), {trim: true}, function(err, result) {
                    response.json({randomNumber: randomNumber, tropoId: result.session.id[0], retries: retries, success: true});
                });
            });

        }).on('error', function(e) {
                response.json({success: false});
        });
    }


    app.get('/:number/:uuid', function(req, res) {
        var randomNumber = Math.random().toString(10).substr(2,4);

        var response = res;
        // set no-cache headers
        response.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');

        // check for tropo retry count
        redisClient.get(req.params.uuid +'_tropo', function(err, result) {
            var retries = result;
            if(retries >= 3) {
                response.json({success: false});
            } else {
                redisClient.get(req.params.uuid +'_troporandom', function(err, result)
                {
                    retries++;
                    if(!result || result === '') {
                        redisClient.set(req.params.uuid +'_troporandom', randomNumber);
                        redisClient.set(req.params.uuid +'_tropo', 1);
                        makeTropoCall(randomNumber, retries, req, res);
                    } else {
                        redisClient.set(req.params.uuid +'_tropo', retries);
                        makeTropoCall(result, retries, req, res);
                    }
                });
            }
        });
    });

    app.post('/', function(req, res){

        var tropo = new TropoWebAPI();

        var say = new Say("Please enter your four digit number");
        var choices = new Choices("[4 DIGITS]", "dtmf");

        tropo.call("+"+ req.body.session.parameters.numberToDial);
        tropo.ask(choices, null, true, null, "digit", null, null, say, 60, null);

        tropo.on("continue", null, "/tropo/tropo/continue?randomNumber="+ req.body.session.parameters.randomNumber, true);
        tropo.on("hangup", null, "/tropo/tropo/fail", true);
        tropo.on("incomplete", null, "/tropo/tropo/fail", true);

        req.session.tropoId = req.body.session.id;
        req.session.save();

        redisClient.set(req.body.session.id, 'pending');

        res.send(TropoJSON(tropo));
    });

    app.post('/fail', function(req, res) {
        redisClient.set(req.body.result.sessionId, 'failed');

        res.send(200);
    });

    app.post('/continue', function(req, res){

        var tropo = new TropoWebAPI();

        var answer = req.body.result.actions.value;

        tropo.say("You said " + answer);
        tropo.on("continue", null, "/tropo/tropo/finish?randomNumber="+ req.query.randomNumber +"&answer="+ answer, true);

        res.send(TropoJSON(tropo));
    });

    app.post('/finish', function(req, res) {
        if(req.query.randomNumber === req.query.answer) {
          redisClient.set(req.body.result.sessionId, 'passed');
        } else {
          redisClient.set(req.body.result.sessionId, 'failed');
        }
        res.send(200);
    });
};