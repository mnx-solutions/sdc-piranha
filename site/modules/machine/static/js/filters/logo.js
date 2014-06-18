'use strict';

(function (app) {

    app.filter('logo', function () {
        return function (name) {
            name = name && name.toLowerCase();

            var instances = {
                //soft
                cassandra: "cassandra",
                elasticsearch: "elasticsearch",
                ghost: "ghost",
                hadoop: "hadoop",
                java: "java",
                manta: "manta",
                mongodb: "mongodb",
                nginx: "nginx",
                node: "node",
                percona: "percona",
                postgresql: "postgresql",
                riak: "riak",
                scalearc: "scalearc",
                stm: "stingray",

                //os
                "arch-demo": "arch",
                base: "smart",
                centos: "centos",
                debian: "debian",
                fedora: "fedora",
                freebsd: "freebsd",
                multiarch: "smart",
                smartos: "smart",
                sngl: "smart",
                ssc: "ubuntu",
                standard: "smart",
                ubuntu: "ubuntu",
                ws20: "windows"
            };

            var result = instances[name];
            if (!result) {
                for (var instanceKey in instances) {
                    if (name && name.indexOf(instanceKey) !== -1) {
                        result = instances[instanceKey];
                        break;
                    }
                }
            }
            if (!result) {
                result = 'advanced-instance-default';
            }
            return result;
        };
    });

}(window.JP.getModule('Machine')));