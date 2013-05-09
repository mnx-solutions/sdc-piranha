'use strict';

var tropo_webapi = require('tropo-webapi-node');
var redis = require('redis');
var config = require('easy-config');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
var http = require('http');
var parseXml = require('xml2js').parseString;

module.exports = function (scope, app, callback) {

  app.get('/status/:tropoid', function(req, res) {
    redisClient.get(req.params.tropoid, function(err, result) {
      res.json({sessionId: req.params.tropoid, status: result});
    })
  });

  app.get('/:number', function(req, res) {
    var randomNumber = Math.floor(Math.random() * 9) +''+ Math.floor(Math.random() * 9) +''+ Math.floor(Math.random() * 9) +''+ Math.floor(Math.random() * 9);

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
        console.log('answer: ', resultBody.toString());
        parseXml(resultBody.toString(), {trim: true}, function(err, result) {
          console.log('XML ', result.session.id[0]);
          response.json({randomNumber: randomNumber, tropoId: result.session.id[0]});
        })
      })

    }).on('error', function(e) {
        console.log("Got error: " + e.message);
      });

  })

  app.post('/', function(req, res){

    var tropo = new TropoWebAPI();

    var say = new Say("Please enter your four digit number");
    var choices = new Choices("[4 DIGITS]");

    console.log('tropo calling to +'+ req.body.session.parameters.numberToDial);

    tropo.call("+"+ req.body.session.parameters.numberToDial);
    tropo.ask(choices, null, null, null, "digit", null, null, say, 60, null);

    tropo.on("continue", null, "/continue?randomNumber="+ req.body.session.parameters.randomNumber, true);
    tropo.on("hangup", null, "/fail", true);
    tropo.on("incomplete", null, "/fail", true);

    console.log('tropo id: ', req.body.session.id);

    req.session.tropoId = req.body.session.id;
    req.session.save();

    redisClient.set(req.body.session.id, 'pending');

    res.send(TropoJSON(tropo));

  });

  app.post('/fail', function(req, res) {
    console.log('fail', req.body);
    redisClient.set(req.body.result.sessionId, 'failed');

    res.send(200);
  })

  app.post('/continue', function(req, res){

    var tropo = new TropoWebAPI();

    var answer = req.body['result']['actions']['value'];

    tropo.say("You said " + answer);
    tropo.on("continue", null, "/finish?randomNumber="+ req.query.randomNumber +"&answer="+ answer, true);

    res.send(TropoJSON(tropo));
  });

  app.post('/finish', function(req, res) {
    console.log('FINISH', req.body.result.sessionId);

    if(req.query.randomNumber == req.query.answer) {
      console.log('PASSED');
      redisClient.set(req.body.result.sessionId, 'passed');
    } else {
      console.log('FAILED');
      redisClient.set(req.body.result.sessionId, 'failed');
    }
    res.send(200);
  })

	setImmediate(callback);
};