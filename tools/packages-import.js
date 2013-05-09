var fs = require('fs');
var csv = require('csv');

var result = {};

csv()
    .from.stream(fs.createReadStream(process.argv[2] || __dirname+'/packages.csv'), {columns: true})
    .on('record', function(row, index){
        result[row.instance_type_name]= {group: row.group, description: row.description};
    })
    .on('end', function(count){
        console.log(JSON.stringify(result, null, " "));
    })
    .on('error', function(error){
        console.log(error.message);
    });