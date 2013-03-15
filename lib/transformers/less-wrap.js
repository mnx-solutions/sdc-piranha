'use strict';

module.exports = function (name) {
	return {
		'_first': true,
		'_transform': function (chunk, encoding, done) {
			if (this._first) {
				this._first = false;
				chunk = Buffer.concat([new Buffer('.JoyentPortal-module-' + name + '{'), chunk])
			}
			this.push(chunk);
			done();
		},
		'_flush': function (done) {
			this.push(new Buffer('}'));
			done();
		}
	};
};