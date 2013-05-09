'use strict';

var tropo_webapi = require('tropo-webapi-node');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var http = require('http');
var parseXml = require('xml2js').parseString;

module.exports = function (scope, app, callback) {

  app.get('/:number', function(req, res) {
    var randomNumber = Math.floor(Math.random() * 10000);
    if(randomNumber === 0) {
        randomNumber = '0000';
    }
    if(randomNumber === 10000) {
        randomNumber = '9999';
    }


    var options = {
      host:'api.tropo.com',
      path: '/1.0/sessions?action=create&token=1ce9e601654a6d459eecdf26eaabf7cb85a9f31031451a0aa3c1afc72c135d73c5398c473e1f150b77ece954&numberToDial='+ req.params.number +'&randomNumber='+ randomNumber
    };

    var response = res;

    var req = http.get(options, function(res) {
      var resultBody;
      res.on('data', function(chunk) {
        resultBody = chunk;
      });

      res.on('end', function() {
        parseXml(resultBody.toString(), {trim: true}, function(err, result) {
          response.json({randomNumber: randomNumber, tropoId: result.session.id[0], success: true});
        });
      });

    }).on('error', function(e) {
          response.json({success: false});
    });

  });

  app.post('/', function(req, res){

    var tropo = new TropoWebAPI();

    var say = new Say("Please enter your four digit number");
    var choices = new Choices("[4 DIGITS]", "dtfm");

    console.log('tropo calling to +'+ req.body.session.parameters.numberToDial);

    tropo.call("+"+ req.body.session.parameters.numberToDial);
    tropo.ask(choices, null, true, null, "digit", null, null, say, 60, null);

    tropo.on("continue", null, "/tropo/tropo/continue?randomNumber="+ req.body.session.parameters.randomNumber, true);
    tropo.on("hangup", null, "/tropo/tropo/fail", true);
    tropo.on("incomplete", null, "/tropo/tropo/fail", true);

    console.log('tropo id: ', req.body.session.id);

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

    var answer = req.body['result']['actions']['value'];

    tropo.say("You said " + answer);
    tropo.on("continue", null, "/tropo/tropo/finish?randomNumber="+ req.query.randomNumber +"&answer="+ answer, true);

    res.send(TropoJSON(tropo));
  });

  app.post('/finish', function(req, res) {
    if(req.query.randomNumber == req.query.answer) {
      redisClient.set(req.body.result.sessionId, 'passed');
    } else {
      redisClient.set(req.body.result.sessionId, 'failed');
    }
    res.send(200);
  });

	setImmediate(callback);
};