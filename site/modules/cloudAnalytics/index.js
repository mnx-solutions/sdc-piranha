'use strict';

var express = require('express');
var app = express();

module.exports.app = app;

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
			res.json(resp);
		}
	});
});

app.post('/ca/instrumentations', function (req, res) {
    console.log('create request');
	req.cloud.CreateInstrumentation(req.body, function (err, resp) {
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

app.post('/ca/instrumentations/:id', function(req, res) {
    req.cloud.CreateInstrumentation(req.body, function (err, resp) {
        if (!err) {
//            resp['uri'] = '/ca/instrumentations/' + resp.id;
//            for (var i = 0; i < resp['uris'].length; i++ ){
//                resp['uris'][i].uri = convertUri(resp['uris'][i].uri);
//            }
            res.json(resp);
        }
    });
})
// get instrumentation values by subject;
app.get('/ca/instrumentations/value/:id', function(req, res) {
    var subject = req.query.subject || req.params.subject;
    if(!subject) {
        throw new Error('no subject specified');
    }
    console.log(subject);
    switch (subject) {
        case 'raw':
            var options = {
                id: req.params.id,
                ndatapoints: req.query.ndatapoints,
                duration: req.query.duration
            };
            if(req.query.start_time) {
                options.start_time = req.query.start_time;
            }
            req.cloud.GetInstrumentationValue(options, function(err, resp) {
                //expected response is an array
                console.log('raw response');
                console.log(resp);
//                var ret = [resp];
                res.json(resp);
            });
            break;
        case 'heatmap':
            console.log('heatmap')
//            console.log(arguments);
            var options = {
                id: req.params.id,
                ndatapoints: 1, //req.query.ndatapoints,
                duration: 1//req.params.duration
            };
            if(req.query.start_time) {
                options.start_time = req.query.start_time;
            }
            req.cloud.GetInstrumentationHeatmap(parseInt(req.params.id), options, function (err, resp) {
                console.log('heatmap response');
                console.log(arguments);
                if (!err) {
                    res.json(resp);
                }
            });
            break;
        case 'heatmap.image':
            req.cloud.GetInstrumentationHeatmap(parseInt(req.params.id), req.query, function (err, resp) {
                if (!err) {
                    res.json(resp);
                }
            });
            break;
        case 'heatmap.details':
            req.cloud.GetInstrumentationHeatmapDetails(parseInt(req.params.id), req.query, function (err, resp) {
                if (!err) {
                    res.json(resp);
                }
            });
            break;
        case 'heatmap.average':
            req.cloud.GetInstrumentationHeatmap(parseInt(req.params.id), req.query, function (err, resp) {
                if (!err) {
                    res.json(resp);
                }
            });
            break;
        default:
            throw new Error('subject:' + subject + ' not found');
    }

})

app.del('/ca/instrumentations/:id', function (req, res) {
    console.log('del request');
    console.log(req.params.id);
	req.cloud.DeleteInstrumentation(parseInt(req.params.id), function (err, resp) {
        console.log(arguments);
	if (!err) {
			res.json(resp);
		}
	});
});

module.exports.csss = [
    'css/app.css',
    'css/ca.css',
    'css/jquery-ui-1.9.2.custom.css',
    'css/jquery.contextMenu.css',
    'css/rickshaw/detail.css',
    'css/rickshaw/graph.css',
    'css/rickshaw/legend.css'
];

module.exports.javascripts = [
    'js/module.js',

    'vendor/jquery/jquery-ui-1.9.2.custom.js',
    'vendor/jquery/jquery.contextMenu.js',
    'vendor/jquery/jquery.colorhelpers.js',
    'vendor/jquery/jquery.dataTables.js',
    'vendor/rickshaw/d3.v2.js',
    'vendor/rickshaw/rickshaw.js',
    'js/services/caBackend.js',
//    'vendor/ca/subr.js',
//    'vendor/ca/color.js',
//    'vendor/ca/caBackendCloudApi.js',
//    'vendor/ca/ca.js',
//    'vendor/ca/app.js',
//    'vendor/ca/useMethod.js',
    'js/directives/instrumentation.js',
    'js/controllers/cloudAnalytics.js',
    'js/config/routes.js'
];

module.exports.authenticate = true;

module.exports.layouts = [
    {
        name: 'cloudAnalytics',
        module: 'cloudAnalytics',
        include: 'partial/cloudAnalytics.html',
        controller: 'cloudAnalyticsController'
    }
];
