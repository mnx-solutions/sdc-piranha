'use strict';

var foldermap = require('foldermap');

module.exports = function (scope, register, callback) {

    var info = {};

    foldermap.map({path: __dirname + '/data', ext:'json', relative:true}, function (err, map) {
        if(err) {
            scope.log.fatal(err);
            process.exit();
        }

        Object.keys(map).forEach(function (f) {
            info[map[f]._base] = {
                data: require(map[f]._path),
                pointer: map[f],
                save: function (data, cb) {
                    var self = this;
                    var string = JSON.stringify(data, null, '  ');
                    var old = self.data;
                    map.__add('old/' + f + '_' + Date.now() + '.json.old', JSON.stringify(old, null, '  '), true, function (oldWriteErr) {
                        if(oldWriteErr) {
                            scope.log.error('Failed to update file ' + f, oldWriteErr);
                            cb(oldWriteErr);
                            return;
                        }
                        map[f].__write(string, function (newWriteErr) {
                            if(newWriteErr) {
                                scope.log.error('Failed to update file ' + f, newWriteErr);
                                cb(newWriteErr);
                                return;
                            }
                            self.data = data;
                            cb();
                        });
                    });
                }
            };
        });
        register('Info', info);
        callback();
    });
};