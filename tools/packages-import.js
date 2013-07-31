var fs = require('fs');
var csv = require('csv');
var async = require('async');

var result = {};

fs.readFile((process.argv[2] || __dirname+'/packages.csv'), function(err, data) {
	csv()
		.from.string(data)
		.to.array(function(results) {
			
				async.each(results, function(results, cb) {
						result[results[7]]= {
							short_name: results[6],
							type: results[8],
							group: results[14],
							description: results[13],
							price: results[15],
							price_month: results[16],
							vcpus: results[11]
						};
						
						cb(null);
				}, function(err) {
					console.log(JSON.stringify(result, null, " "));
				});

		}).on('end', function(count) {
			
		}).on('error', function(error){
			console.log(error.message);
		});
});