# Joyent Public Cloud Portal (piranha)

Production: <https://my.joyentcloud.com/>  
Repository: <https://github.com/joyent/piranha>  
Browsing: <https://github.com/joyent/piranha>  
Contacts: Lloyd Dewolf, Jens Schutt   
Docs: <https://hub.joyent.com/wiki/display/PIRANHA/Home> (out of date)  
Tickets/bugs: <https://sdcportal.atlassian.net/browse/PIRANHA>

## Overview

Originally billed as the SDC7 Client Portal, it is currently focused on Joyent Public Cloud.

The project code name of 'piranha' has no special meaning other than Joyent's fondness for fish named projects. It is also hard to spell.

## Repository

    lib/
    site/
    site/config/ configuration and 3rd API keys
    smf/
    test/
    tools/
    var/
    Gruntfile.js
    README.md
    env.json
    index.js
    package.json

## Installation

### Development

Development regularly occurs on Linux until it is ready for staging. Lloyd encourages development on SmartOS to be "close to production".

1. `ssh git@git.joyent.com` Confirms access to the private repositories. Connection will immediately close.
2. `git clone git@github.com:joyent/piranha.git`  
3. `npm install` 
4. Create environment configuration file including uploading a private ssh key of a 'developer' user for SDC. See Configuration section below.
5. `node index.js -env={environment}`

### Staged Development

The production environment is currently SmartOS 64-bit - base64 13.1.0, so we use the same for staged development.
* Use 'ssh -A' to connect to the instance, forwarding your authentication agent.

1. `ssh git@git.joyent.com` Confirms access to the private repositories. Connection will immediately close.  
2. `pkgin up; pkgin in scmgit-base redis build-essential`
3. `svcadm enable redis:default`
4. `git clone git@github.com:joyent/piranha.git /opt/portal`  
5. `cd /opt/portal; npm install --production`
6. Create environment configuration file including uploading a private ssh key of a 'developer' user for SDC. See Configuration section below.
7. `svccfg import /opt/portal/smf/portal.xml`
8. `svcadmin enable portal`

### Production

FIXME: moving to tarballs including all node.js modules and automated deployment using chef.

## Update

### Development & Staged

1. `svcadmin disable portal`
2. `rm -rf /opt/portal/node_modules/*`
3. `git pull`
5. `cd /opt/portal; npm install --production`
8. `svcadmin enable portal`

### Production

FIXME: with a `make install`

## Configuration

piranha uses [easy-config][1] for configuration handling. The default config file is `site/config/config.json`. When piranha is started with the `-env={environment}` command line option, the values in `site/config/config.{environment}.json` overwrite those from `config.json`.

You can also define configuration options using command line. ex: `$ node index.js -env=pro --log.level=fatal`

- `assets.*` [express-modulizer][3] magic.
- `billing.url` [billing-server][4] url
- `billing.noUpdate` Do not talk to billing server
- `capishim.username` Capishim username
- `capishim.password` Capishim password
- `capishim.url` Capishim url
- `capishim.noUpdate` Do not talk to capi shim
- `cloudapi.version` If defined this is used for Api-version header for CloudAPI calls.
- `cloudapi.url` CloudAPI endpoint url
- `cloudapi.urls` If defined (Array) this is used instead of url. Here you can define multiple CloudAPI (datacenter) URL's so if one fails, portal will take the next one
- `cloudapi.DCCallTimeout` Datacenter call timeout in ms.
- `cloudapi.username` Username from AdminUI
- `cloudapi.keyId` Your SSH key fingerprint from Admin portal
- `cloudapi.keyPath` Full local path to your private key file
- `googleAnalytics.identifier` Google analytics ID
- `googleAnalytics.domain` Google analytics domain
- `localization.defaultLocale` Default language for portal
- `localization.locales` Possible languages in portal
- `log.name` Name which will appear in every log message
- `log.level` Log level used by [Bunyan][2]. Possible values: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- `marketo.apikey` Marketo API key
- `marketo.accountId` Markerto Account Id
- `maxmind.phoneApiUrl` MaxMind Phone API URL
- `maxmind.fraudApiUrl` MaxMind Fraud API URL
- `maxmind.licenseId` MaxMind license ID
- `maxmind.limits.calls` Maximum calls allowed
- `maxmind.limits.serviceFails` Maximum service fails after which verification is skipped
- `maxmind.pinTries` Maximum pin entries
- `maxmind.riskScoreFraudLimit` Maximum risk score allowed, value can be 0..100 where 0 = block everyone; 100 = allow everyone
- `maxmind.testClientIp` Set your IP address for testing
- `maxmind.testRiskScore` Set your risk score for testing
- `polling.machineTags` Time in ms how long can machine tags polling take before fail
- `polling.machineState` Time in ms how long can machine state polling take before fail
- `polling.packageChange` Time in ms how long can packge change take before fail
- `redis.host` Redis storage host
- `redis.port` Redis storage port
- `redis.db` Redis database index
- `redis.password` Redis storage password
- `server.port` Port on which piranha portal runs on.
- `server.headerClientIpKey` Client IP address placeholder for load balancer / reverse proxy
- `sso.url` Signle Sign-on service url
- `sso.keyIid` Your SSH key fingerprint in path format. ex: /{udrtnsmr}/keys/{fingerprint}
- `sso.keyPath` Full local path to your private key file
- `zendesḱ.account` Zendesk account with trailing `/token`
- `zendesk.token` Zendesk token
- `zendesk.host` Zendesk host
- `zendesk.forumsPath` Path to Zendesk forums json
- `zendesk.systemStatusPath` Path to Zendesk system statuses topic json
- `zendesk.packageUpdatePath` Path to Zendesk packages updates topic json
- `zuora.tenantID` Zuoras tenant ID
- `zuora.api.user` Zuora API user
- `zuora.api.password` Zuora API password
- `zuora.api.validation.countries.type` Zuora validation rule type
- `zuora.api.validation.countries.name` Which field rule uses
- `zuora.api.validation.countries.list` Rule values
- `zuora.soap` GuartTime TBD

## Common errors:
`Cannot find module {X}`
    You don't have module X and need to install it using `npm install {X}`.

`Invalid developer` message when logging in to the portal in the web browser.
    Your `sso.keyId` or `sso.keyPath` are wrong. Re-check them and make sure they are in SDC Admin. 

[1]:https://github.com/DeadAlready/node-easy-config
[2]:https://github.com/trentm/node-bunyan
[3]:https://github.com/joyent/node-express-modulizer
[4]:https://github.com/joyent/piranha-billing-server
