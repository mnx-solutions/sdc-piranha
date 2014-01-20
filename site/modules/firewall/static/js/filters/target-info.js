'use strict';

(function(ng, app) {
	app.filter('targetInfo', function() {
		return function(target) {
			if(target[0] === 'wildcard') {
                if (target[1] === 'any'){
				    return 'ANY';
                }

                if (target[1] === 'all vms'){
                    return 'ANY VMs in DC';
                }
			}
			if(target[0] === 'tag' && ng.isArray(target[1])) {
				return target[0] + ': ' + target[1][0] + ' = ' + target[1][1];
			}
			return target[0] + ': ' + target[1];
		};
	});
}(window.angular, window.JP.getModule('firewall')));