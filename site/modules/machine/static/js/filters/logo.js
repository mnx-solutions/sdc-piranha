'use strict';

(function (app) {

    app.filter('logo', function () {
        return function (name) {
            var name = name.toLowerCase();

            var instances = {
                base: "base",
                base64: "base64",
                hadoop: "hadoop",
                riak: "riak",
                sngl: "sngl",
                "centos-6": "centos",
                freebsd: "freebsd",
                ssc: "ssc",
                "ubuntu-12.04": "ubuntu",
                "ubuntu-certified-12.04": "ubuntu",
                "ws2008ent-r2-sp1": "windows",
                "ws2008std-r2-sp1": "windows",
                "ws2012std": "windows"
            }

            return instances[name] ? 'advanced-instance-' + instances[name] : 'advanced-instance-default';
        };
    });

}(window.JP.getModule('Machine')));