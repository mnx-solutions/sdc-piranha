#! /bin/bash

echo 'Installing memstat...'

MEMSTAT_PORT=8888

killall -9 haproxy

sed -i '/acl is_cadvisor url_beg \/utilization\//a \    acl is_memstat url_beg /memStat/' /etc/haproxy/haproxy.cfg
sed -i '/use_backend cadvisor_back if is_cadvisor/a \    use_backend memstat_back if is_memstat' /etc/haproxy/haproxy.cfg

cat <<END >>/etc/haproxy/haproxy.cfg

backend memstat_back
    mode http
    reqrep ^([^\ :]*)\ /memStat/(.*) \1\ /\2
    server m 127.0.0.1:${MEMSTAT_PORT}

END

/etc/init.d/haproxy restart

mkdir /opt/memStat

cat <<END >/opt/memStat/getMemoryUsage.sh
#! /bin/bash
free | grep Mem | awk '{print \$3/\$2 * 100.0}'
END

cat <<END >/opt/memStat/getCpuUsage.sh
#! /bin/bash
top -b -n2 | grep 'Cpu(s)'|tail -n 1 | awk '{print \$2 + \$4}'
END

cat <<END >/opt/memStat/memStat.py
import subprocess
import BaseHTTPServer

class MyHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def do_GET(s):
        s.send_response(200)
        s.send_header("Content-type", "application/json")
        s.end_headers()
        cpuUsage = subprocess.check_output("/opt/memStat/getCpuUsage.sh")
        memoryUsage = subprocess.check_output("/opt/memStat/getMemoryUsage.sh")
        s.wfile.write('{"memoryUsage":' + memoryUsage + ', "cpuUsage": ' + cpuUsage + '}')

server_class = BaseHTTPServer.HTTPServer
httpd = server_class(('127.0.0.1', ${MEMSTAT_PORT}), MyHandler)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
httpd.server_close()
END

chmod 777 /opt/memStat/getMemoryUsage.sh
chmod 777 /opt/memStat/getCpuUsage.sh

sed -i -e '$i python /opt/memStat/memStat.py &\n' /etc/rc.local

python /opt/memStat/memStat.py &

echo 'Installing memStat completed.'