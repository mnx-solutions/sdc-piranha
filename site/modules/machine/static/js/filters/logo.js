'use strict';

(function (app) {

    app.filter('logo', function () {
        return function (name) {
            name = name && name.toLowerCase();

            var instances = {
                "arch-demo-0001": "arch",
                "arch-demo-0002": "arch",
                base: "smart",
                base64: "smart",
                hadoop: "hadoop",
                mongodb: "mongodb",
                multiarch: "smart",
                percona: "percona",
                smartos: "smart",
                smartos64: "smart",
                smartosplus64: "smart",
                standard: "smart",
                standard64: "smart",
                "debian-6.03": "debian",
                "debian-6.0.6": "debian",
                "debian-6.0.7": "debian",
                "stm-1000h": "stingray",
                "stm-1000m": "stingray",
                "stm-1000m-saf": "stingray",
                "stm-2000l": "stingray",
                "stm-2000l-saf": "stingray",
                "stm-2000l-saf-stx": "stingray",
                "stm-2000l-stx": "stingray",
                "stm-2000m-saf-stx": "stingray",
                "stm-2000m-stx": "stingray",
                "stm-4000l": "stingray",
                "stm-500l-10": "stingray",
                "stm-500m-200": "stingray",
                "stm-developer": "stingray",
                "stm-adc": "stingray",
                riak: "riak",
                sngl: "smart",
                java: "java",
                "manta-build": "manta",
                "centos-6": "centos",
                "centos-5.7": "centos",
                "centos-node.js": "node",
                "nodejs": "node",
                "node.js": "node",
                freebsd: "freebsd",
                fedora: "fedora",
                ssc: "ubuntu",
                "ubuntu-12.04": "ubuntu",
                "ubuntu-10.04": "ubuntu",
                "ubuntu-certified-13.10": "ubuntu",
                cassandra: "cassandra",
                "ubuntu-certified-12.04": "ubuntu",
                "ws2008ent-r2-sp1": "windows",
                "ws2008std-r2-sp1": "windows",
                "ws2012std": "windows",
                "centos": "centos",
                "ubuntu": "ubuntu",
                "elasticsearch": "elasticsearch",
                "ghost": "ghost",
                "postgresql": "postgresql",
                "debian-7": "debian",
                "ScaleArc-MSSQL-Enterprise-2CPU-2GB": "scalearc",
                "ScaleArc-MySQL-Enterprise-1CPU-1GB": "scalearc",
                "ScaleArc-MySQL-Enterprise-2CPU-2GB": "scalearc",
                "ScaleArc-MySQL-Enterprise-5CPU-10GB": "scalearc",
                "ScaleArc-MySQL-Platinum-2CPU-2GB": "scalearc",
                "ScaleArc-MySQL-Platinum-5CPU-32GB": "scalearc",
                "nginx": "nginx"
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