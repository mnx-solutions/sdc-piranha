# piranha

piranha is a portal for Joyent Cloud Services

## Installation
    - Setup redis. Either use your package manager to install redis or download it from http://redis.io/download
    - create environment configuration file (more in Config section)
    $ npm install
    $ node index.js -env={environment}
(Warning: piranha is using some private modules, so make sure you have access to them before installing)

## Installation on Joyent smartmachine
    1. provision a fresh smartmachine base 13.1.0 works fine,
        it has the added benefit of having a recent enough nodejs installed already
    2. verify nodejs version 0.10.x is present
    3. verify git, gcc47 and gmake are present
    4. add user portal (useradd portal)
    5. cd /opt/; git clone git@github.com:/joyent/piranha.git portal (need ssh -A to the host before)
    6. check portal/smf/portal.xml looks sane
    7. copy deployment configuration file config.pro.json to /opt/portal/site/config
    8. copy deployment ssh key to /opt/portal/site/config
    9. cd /opt/portal; npm install -production
    10. svccfg import /opt/portal/smf/portal.xml

## Configuration

piranha is using [easy-config][1] module for configuration handling.
piranha config can be found in `site/config/config.json` which also holds all default values (portal does not start up on these)
For environmental configurations create `config.{environment}.json` and start piranha with `-env={environment}` option. This will load your enviromental configuration on top of config.json.
You can also define configuration options using command line. ex: `$ node index.js -env=pro --log.level=fatal`


- `server.port` Port on which piranha portal runs on.
- `log.name` Name which will appear in every log message
- `log.level` Log level used by [Bunyan][2]. Possible values: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
- `cloudapi.version` If defined this is used for Api-version header for CloudAPI calls.
- `cloudapi.url` CloudAPI endpoint url
- `cloudapi.urls` If defined (Array) this is used instead of url. Here you can define multiple CloudAPI (datacenter) URL's so if one fails, portal will take the next one
- `cloudapi.DCCallTimeout` Datacenter call timeout in ms.
- `cloudapi.username` Username from AdminUI
- `cloudapi.keyId` Your SSH key fingerprint from Admin portal
- `cloudapi.keyPath` Full local path to your private key file
- `sso.url` Signle Sign-on service url
- `sso.keyIid` Your SSH key fingerprint in path format. ex: /{udrtnsmr}/keys/{fingerprint}
- `sso.keyPath` Full local path to your private key file
- `localization.defaultLocale` Default language for portal
- `localization.locales` Possible languages in portal
- `redis.host` Redis storage host
- `redis.port` Redis storage port
- `redis.db` Redis database index
- `redis.password` Redis storage password
- `assets.*` [express-modulizer][1] magic.
- `zuora.tenantID` Zuoras tenant ID
- `zuora.api.user` Zuora API user
- `zuora.api.password` Zuora API password
- `zuora.api.validation.countries.type` Zuora validation rule type
- `zuora.api.validation.countries.name` Which field rule uses
- `zuora.api.validation.countries.list` Rule values
- `billing.url` [billing-server][4] url
- `zendesḱ.account` Zendesk account with trailing `/token`
- `zendesk.token` Zendesk token
- `zendesk.host` Zendesk host
- `zendesk.forumsPath` Path to Zendesk forums json
- `zendesk.systemStatusPath` Path to Zendesk system statuses topic json
- `zendesk.packageUpdatePath` Path to Zendesk packages updates topic json
- `marketo.apikey` Marketo API key
- `marketo.accountId` Markerto Account Id
- `polling.machineTags` Time in ms how long can machine tags polling take before fail
- `polling.machineState` Time in ms how long can machine state polling take before fail
- `polling.packageChange` Time in ms how long can packge change take before fail
- `capishim.username` Capishim username
- `capishim.password` Capishim password
- `capishim.url` Capishim url

## Common errors:
`Cannot find module {X}`
    You don't have module X and need to install it using `npm install {X}`. Make sure you have access to it, because piranha is using some private modules.

`Invalid developer` in SSO
    Your `sso.keyId` or `sso.keyPath` are wrong. Re-check them and make sure they are in Admin portal.

[1]:https://github.com/DeadAlready/node-easy-config
[2]:https://github.com/trentm/node-bunyan
[3]:https://github.com/joyent/node-express-modulizer
[4]:https://github.com/joyent/piranha-billing-server