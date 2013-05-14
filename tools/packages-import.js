var fs = require('fs');
var csv = require('csv');

var result = {};

csv()
    .from.stream(fs.createReadStream(process.argv[2] || __dirname+'/packages.csv'), {columns: true})
    .on('record', function(row, index){
        // turning price strings to floats and round up to nearest penny;
        var price = Math.ceil(parseFloat(row.Price.split(',').join('')) * 100) / 100;
        var price_month = Math.ceil(parseFloat(row["Price Per Month"].split(',').join('')) * 100) / 100;
        result[row["Joyent Instant Type Name"]]= {type: row.TYPE, group: row["Pricing Group"], description: row.Description, price: price, price_month: price_month};
    })
    .on('end', function(count){
        console.log(JSON.stringify(result, null, " "));
    })
    .on('error', function(error){
        console.log(error.message);
    });