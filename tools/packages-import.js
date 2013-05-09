var fs = require('fs');
var csv = require('csv');

var result = {};

csv()
    .from.stream(fs.createReadStream(process.argv[2] || __dirname+'/packages.csv'), {columns: true})
    .on('record', function(row, index){
        result[row["Joyent Instant Type Name"]]= {type: row.TYPE, group: row["Pricing Group"], description: row.Description, price: row.Price, price_month: row["Price Per Month"]};
    })
    .on('end', function(count){
        console.log(JSON.stringify(result, null, " "));
    })
    .on('error', function(error){
        console.log(error.message);
    });