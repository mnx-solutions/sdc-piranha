'use strict';

var lessWrap = require('./transformers/less-wrap');
var utils = require('./utils');

module.exports = function (rack, config) {
	var comp = {
		js: {
			concat: ['use-strict-rm'],
			cache:'all',
			ext:'js',
			transform: ['use-strict-add','gzip']
		},
		css: {
			concat:true,
			cache:'all',
			ext:'css',
			transform: ['less', 'gzip']
		}
	};
	comp = utils.extend(comp, config.static || {});

	return function compiler (locals, callback) {
		var newAssets = locals;
		var count = 2;

		function add(name) {
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

		var cssAssets = {};
		var cssIndex = {};
		newAssets.css.forEach(function (css, index) {
			if (css._scope.type === 'module') {
				if (!cssAssets[css._scope.id]) {
					cssAssets[css._scope.id] = [css];
				} else {
					cssAssets[css._scope.id].push(css);
				}
				cssIndex[css._url + css._path] = index;
			}
		});

		var count2 = Object.keys(cssAssets).length;

		if (count2 === 0) {
			add('css');
		} else {
			Object.keys(cssAssets).forEach(function (mod) {
				rack.addAssets(cssAssets[mod], {
					cache: 'local',
					transform: [lessWrap(mod)]
				}, function (err, csss) {
					if (err) {
						console.log(err);
						process.exit();
					}
					csss.forEach(function (css) {
						newAssets.css[cssIndex[css._oldUrl + css._input._path]] = css;
					});
					if (--count2 === 0) {
						add('css');
					}
				});
			});
		}
	};
}
