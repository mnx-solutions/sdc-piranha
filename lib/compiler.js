'use strict';

var lessWrap = require('./transformers/less-wrap');
var cssUrl = require('./transformers/css-url');
var utils = require('./utils');
var path = require('path');

module.exports = function (rack, config) {
    var comp = {
        js: {
            concat: ['use-strict-rm'],
            cache:'all',
            ext:'js',
            transform: ['use-strict-add','gzip'],
            watch: true
        },
        css: {
            concat:true,
            cache:'all',
            ext:'css',
            transform: ['less', 'gzip'],
            watch: true
        }
    };
    comp = utils.extend(comp, config.static || {});

    return function compiler (app, locals, callback) {
        var newAssets = locals;
        var count = 3;

        function add(name) {
            if(!newAssets[name]){
                if (--count === 0) {
                    callback(null, newAssets);
                }
                return;
            }
            rack.addAssets(newAssets[name], comp[name], function (err, assets) {
                if (err) {
                    console.log(err);
                    process.exit();
                }
                newAssets[name] = assets;
                if (--count === 0) {
                    callback(null, newAssets);
                }
            });
        }
        add('js');

        function getContent(partial, cb) {
            partial.__read(function(err, data) {
                if(err) {
                    console.log(err);
                    process.exit();
                }
                partial._content = data;
                if(cb) {
                    cb();
                }
            });
        }

        var cssIndex = {};
        newAssets.css.forEach(function (css, index) {
            cssIndex[css._url + css._path] = index;
        });

        var count2 = newAssets.css.length;

        if (count2 === 0) {
            add('css');
        } else {
            newAssets.css.forEach(function (css) {
                var mod = css._scope && css._scope.type === 'module' ? css._scope.id : '';
                var route = path.dirname(css._url);
                var transform = [cssUrl(route)];
                if (mod !== '') {
                    transform.push(lessWrap(mod));
                }
                rack.addAsset(css, {
                    cache: 'local',
                    transform: transform,
                    watch: false
                }, function (err, cs) {
                    if (err) {
                        console.log(err);
                        process.exit();
                    }
                    newAssets.css[cssIndex[cs._oldUrl + cs._input._path]] = cs;
                    if (--count2 === 0) {
                        add('css');
                    }
                });
            });
        }


        if(newAssets.partials && newAssets.partials.length) {
            var count3 = newAssets.partials.length;

            newAssets.partials.forEach(function (partial) {

                partial._id = path.join(partial._scope.id,'static','partials', partial._name);
                getContent(partial, function (){
                    if(--count3 === 0 && --count === 0) {
                        callback(null, newAssets);
                    }
                });
                partial.__listen('change', function () {
                    getContent(partial);
                });
                partial.__startWatch();
            });
        } else {
            newAssets.partials = [];
            if (--count === 0) {
                callback(null, newAssets);
            }
            return;
        }
    };
}
