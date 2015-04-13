'use strict';

var foldermap = require('foldermap');
var fs = require('fs');

exports.init = function execute(log, config, done) {

    var info = {};

    foldermap.map({path: __dirname + '/data', ext:['json', 'html'], relative:true}, function (err, map) {
        if (err) {
            log.fatal(err);
            process.exit();
        }

        Object.keys(map).forEach(function (f) {
            info[map[f]._base] = {
                data: map[f]._ext === 'json' ? require(map[f]._path) : fs.readFileSync(map[f]._path, 'utf8'),
                pointer: map[f],
                save: function (data, cb) {
                    var self = this;
                    var string = map[f]._ext === 'json' ? JSON.stringify(data, null, 2) : data.data;
                    var old = map[f]._ext === 'json' ? JSON.stringify(self.data, null, 2) : self.data;
                    map.__add('old/' + f + '_' + Date.now() + '.' + map[f]._ext + '.old', old, true, function (oldWriteErr) {
                        if (oldWriteErr) {
                            log.error('Failed to update file ' + f, oldWriteErr);
                            cb(oldWriteErr);
                            return;
                        }
                        map[f].__write(string, function (newWriteErr) {
                            if (newWriteErr) {
                                log.error('Failed to update file ' + f, newWriteErr);
                                cb(newWriteErr);
                                return;
                            }
                            self.data = map[f]._ext === 'json' ? data : data.data;
                            cb();
                        });
                    });
                }
            };
        });
        exports.Info = info;
        done();
    });
};