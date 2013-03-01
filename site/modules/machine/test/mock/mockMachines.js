var MockMachines = {
    getMachines:function (){
        return [{
                  "id": "104904f3-2ba3-428d-918f-b2bac299ff3f",
                  "name": 'Marabu',
                  "type": "virtualmachine",
                  "state": "running",
                  "dataset": "sdc:jpc:ubuntu-12.04:2.2.1",
                  "ips": [
                    "172.20.201.114"
                  ],
                  "memory": 512,
                  "disk": 10240,
                  "metadata": {
                    "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDYD31wSAZNQx/SpuK9yzd58UYt4/k2i3otrtQKiqGREsFpk4dNofKFgMrO18j2sBbeOYcLO+6zI3GYcroZSM5erUTuozcEvqm9ab2R57c5Xfq7i7q/Ie/MaU+dSRXDrhatB4ijgYXG/pmkSjJ4yZA1FOwXZmK97d+7hTykDYjBG8UPYftTcun3yKFf9VjlFgCcR1AEbNYiK7nL6Wsuluw91ztI7k3HhOqTR0/b6idrvgN7zVFBJVQg0IOaORPM88mfaqJomOto+seluOhJKOgaj77DK0eaSeeAgJioDZhQmdUAI/6PMlnc/sN7GO84fDAsKhVm6mJH9t8fLI2CFfsz harri.siirak@gmail.com"
                  },
                  "created": "2013-01-07T14:12:19+00:00",
                  "updated": "2013-01-23T11:18:09+00:00"
                },
                {
                  "id": "69d4481a-99bd-4021-a466-7d20e012e5b6",
                  "name": null,
                  "type": "virtualmachine",
                  "state": "running",
                  "dataset": "sdc:sdc:ubuntu10.04:0.1.0",
                  "ips": [
                    "172.20.201.120"
                  ],
                  "memory": 512,
                  "disk": 10240,
                  "metadata": {
                    "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDYD31wSAZNQx/SpuK9yzd58UYt4/k2i3otrtQKiqGREsFpk4dNofKFgMrO18j2sBbeOYcLO+6zI3GYcroZSM5erUTuozcEvqm9ab2R57c5Xfq7i7q/Ie/MaU+dSRXDrhatB4ijgYXG/pmkSjJ4yZA1FOwXZmK97d+7hTykDYjBG8UPYftTcun3yKFf9VjlFgCcR1AEbNYiK7nL6Wsuluw91ztI7k3HhOqTR0/b6idrvgN7zVFBJVQg0IOaORPM88mfaqJomOto+seluOhJKOgaj77DK0eaSeeAgJioDZhQmdUAI/6PMlnc/sN7GO84fDAsKhVm6mJH9t8fLI2CFfsz harri.siirak@gmail.com"
                  },
                  "created": "2013-01-18T09:37:11+00:00",
                  "updated": "2013-01-18T21:03:46+00:00"
                },
                {
                  "id": "9b780605-1935-44e8-8040-210f29441b2c",
                  "name": null,
                  "type": "virtualmachine",
                  "state": "running",
                  "dataset": "sdc:sdc:ubuntu10.04:0.1.0",
                  "ips": [
                    "172.20.201.124"
                  ],
                  "memory": 256,
                  "disk": 5120,
                  "metadata": {
                    "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDYD31wSAZNQx/SpuK9yzd58UYt4/k2i3otrtQKiqGREsFpk4dNofKFgMrO18j2sBbeOYcLO+6zI3GYcroZSM5erUTuozcEvqm9ab2R57c5Xfq7i7q/Ie/MaU+dSRXDrhatB4ijgYXG/pmkSjJ4yZA1FOwXZmK97d+7hTykDYjBG8UPYftTcun3yKFf9VjlFgCcR1AEbNYiK7nL6Wsuluw91ztI7k3HhOqTR0/b6idrvgN7zVFBJVQg0IOaORPM88mfaqJomOto+seluOhJKOgaj77DK0eaSeeAgJioDZhQmdUAI/6PMlnc/sN7GO84fDAsKhVm6mJH9t8fLI2CFfsz harri.siirak@gmail.com"
                  },
                  "created": "2013-01-29T15:52:45+00:00",
                  "updated": "2013-01-29T16:15:10+00:00"
                
                },
                {
                  "id": "9b780605-1935-44e8-8040-210f29441b2c",
                  "name": null,
                  "type": "virtualmachine",
                  "state": "running",
                  "dataset": "sdc:sdc:ubuntu10.04:0.1.0",
                  "ips": [
                    "172.20.201.124"
                  ],
                  "memory": 256,
                  "disk": 5120,
                  "metadata": {
                    "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDYD31wSAZNQx/SpuK9yzd58UYt4/k2i3otrtQKiqGREsFpk4dNofKFgMrO18j2sBbeOYcLO+6zI3GYcroZSM5erUTuozcEvqm9ab2R57c5Xfq7i7q/Ie/MaU+dSRXDrhatB4ijgYXG/pmkSjJ4yZA1FOwXZmK97d+7hTykDYjBG8UPYftTcun3yKFf9VjlFgCcR1AEbNYiK7nL6Wsuluw91ztI7k3HhOqTR0/b6idrvgN7zVFBJVQg0IOaORPM88mfaqJomOto+seluOhJKOgaj77DK0eaSeeAgJioDZhQmdUAI/6PMlnc/sN7GO84fDAsKhVm6mJH9t8fLI2CFfsz harri.siirak@gmail.com"
                  },
                  "created": "2013-01-29T15:52:45+00:00",
                  "updated": "2013-01-29T16:15:10+00:00"
                
                },
                {
                  "id": "9b780605-1935-44e8-8040-210f29441b2c",
                  "name": null,
                  "type": "virtualmachine",
                  "state": "running",
                  "dataset": "sdc:sdc:ubuntu10.04:0.1.0",
                  "ips": [
                    "172.20.201.124"
                  ],
                  "memory": 256,
                  "disk": 5120,
                  "metadata": {
                    "root_authorized_keys": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDYD31wSAZNQx/SpuK9yzd58UYt4/k2i3otrtQKiqGREsFpk4dNofKFgMrO18j2sBbeOYcLO+6zI3GYcroZSM5erUTuozcEvqm9ab2R57c5Xfq7i7q/Ie/MaU+dSRXDrhatB4ijgYXG/pmkSjJ4yZA1FOwXZmK97d+7hTykDYjBG8UPYftTcun3yKFf9VjlFgCcR1AEbNYiK7nL6Wsuluw91ztI7k3HhOqTR0/b6idrvgN7zVFBJVQg0IOaORPM88mfaqJomOto+seluOhJKOgaj77DK0eaSeeAgJioDZhQmdUAI/6PMlnc/sN7GO84fDAsKhVm6mJH9t8fLI2CFfsz harri.siirak@gmail.com"
                  },
                  "created": "2013-01-29T15:52:45+00:00",
                  "updated": "2013-01-29T16:15:10+00:00"
                }
            ];
    }
};

window.angular.module('mocks.Machines', []).value('Machines', MockMachines);