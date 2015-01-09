# Joyent Public Cloud Portal (piranha)

Production: <https://my.joyentcloud.com/>  
Repository: <https://github.com/joyent/piranha>  
Browsing: <https://github.com/joyent/piranha>  
Contacts: Lloyd Dewolf, Jens Schutt, Tyson Hom   
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
3. `npm install` (if you get errors, try `npm i --production`)
4. Create environment configuration file including uploading a private ssh key of a 'developer' user for SDC. See Configuration section below. Better yet, get someone else's working config file and use that as the `{environment}` when starting the server.
5. Make sure portal user has rights to write var/error.json `chown -R portal var/`
6. If Redis isn't installed and running, [install](http://redis.io/download) and [run](http://reistiago.wordpress.com/2011/07/23/installing-on-redis-mac-os-x/) it
7. `node index.js -env={environment}`

### Staged Development

The production environment is currently SmartOS 64-bit - base64 13.1.0, so we use the same for staged development.
* Use 'ssh -A' to connect to the instance, forwarding your authentication agent.

1. Test access to Joyent git repos: `ssh git@git.joyent.com` (Confirms access to the private repositories. Connection will immediately close)  
2. Update and install system packages: `pkgin up; pkgin -y install scmgit-base redis build-essential`
3. Enable local Redis service: `svcadm enable redis:default`
4. Clone Piranha repo from GitHub: `git clone git@github.com:joyent/piranha.git /opt/portal` 
5. Create a new non-root user for portal: `useradd -s /bin/false -m portal`
6. Install node.js modules: `cd /opt/portal; npm install --production`
6. Make sure that portal user owns its files: `chown -R portal /opt/portal`
7. Create environment configuration file including uploading a private ssh key of a 'developer' user for SDC. See Configuration section below.
8. Import portal service configuration file: `svccfg import /opt/portal/smf/portal.xml`
9. Start portal: `svcadm enable portal`

### Production

#### Build tarball

1. Pull latest changes from repo: `git pull`
2. Check out latest release tag: `git checkout tagname` (where tagname is release tag name, e.g. v1.3.6)
3. Build: `make build`
4. Copy `portal-tagname.tar.gz` tarball to production environment

`make build` step executes `tools/build-tar.js` node script that will build deployment tarball.

Script will do the following:

1. Check if latest tags & branch is checked out and correct
2. Check if current machine is SM Base64 13.1.0
3. Make clean node_modules production install
4. Check if 'npm list' is clean
5. Makes tar, exluding .gitignore files, gzips it

Possible tar builder flags:
* `--skip-tags` - Skip git tag/branch checking
* `--skip-package` - Skip smartmachine package check
* `--in-root` - Use this when build-tar.js is in piranha root instead of tools/
* `--debug` - When this flag is present, debug.log is generated with output
* `--help` - Displays possible flags

#### Deploy tarball

1. Create a new non-root user for portal if it doesn't exist: `useradd -s /bin/false -m portal`
2. Create directory for portal files: `/opt/portal`
3. Unpack production tarball: `tar xvzf portal-tagname.tar.gz --directory=/opt/portal`
4. Make sure that portal user owns its files: `chown -R portal /opt/portal`
5. Create environment configuration file including uploading a private ssh key of a 'developer' user for SDC. See Configuration section below.
6. Import portal service configuration file: `svccfg import /opt/portal/smf/portal.xml`
7. Start portal: `svcadm enable portal`

## Update

### Development & Staged

1. Stop portal: `svcadm disable portal`
2. Change working directory: `cd /opt/portal`
3. Remove installed node.js modules: `rm -rf node_modules/`
4. Pull latest changes from repo: `git fetch origin; git fetch --tags origin`
5. Merge fetched changes: `git merge origin`
6. Install node.js modules: `npm install --production`
7. Start portal: `svcadm enable portal`

## Testing

### E2E

piranha uses [Protractor][5] as AngularJS E2E tests runner.

Install development dependencies:

    npm install --development
    grunt install:dev
    
Create local configuration for E2E tests:

    cp test/e2e/config/config.json test/e2e/config/config.test.json # Copy main config
    vi test/e2e/config/config.test.json  # Override options
    
Run tests:

    grunt test:e2e
    
Run tests in automatic mode:

    grunt autotest:e2e

### UI unit tests

piranha uses [Karma][6] as AngularJS unit tests runner.

To run unit tests: 

    grunt test:unit

To run unit tests in automatic mode: 

    grunt autotest:unit


## Configuration

piranha uses [easy-config][1] for configuration handling. The default config file is `site/config/config.json`. When piranha is started with the `-env={environment}` command line option, the values in `site/config/config.{environment}.json` overwrite those from `config.json`.

You can also define configuration options using command line. ex: `$ node index.js -env=pro --log.level=fatal`

- `assets.*` [express-modulizer][3] magic.
- `billing.url` [billing-server][4] url
- `billing.noUpdate` Do not talk to billing server
- `billing.rejectUnauthorized` Reject unauthorized SSL connection 
- `capishim.username` Capishim username
- `capishim.password` Capishim password
- `capishim.url` Capishim url
- `capishim.noUpdate` Do not talk to capi shim
- `capishim.allowSelfSigned` Dev option to allow self-signed certificates
- `cloudapi.version` If defined this is used for Api-version header for CloudAPI calls.
- `cloudapi.url` CloudAPI endpoint url
- `cloudapi.urls` If defined (Array) this is used instead of url. Here you can define multiple CloudAPI (datacenter) URL's so if one fails, portal will take the next one
- `cloudapi.DCCallTimeout` Datacenter call timeout in ms.
- `cloudapi.username` Username from AdminUI
- `cloudapi.keyId` Your SSH key fingerprint from Admin portal
- `cloudapi.keyPath` Full local path to your private key file
- `images.types` List of machine types supported for image creation
- `images.earliest_date` Only allow images from machines created after this date
- `slb.ssc_private_key` Hardcode if on west-x, do not use on west-1
- `slb.ssc_public_key` Hardcode if on west-x, do not use on west-1
- `slb.slb_code_url` Download location for SLB API code
- `slb.sdc_url` Hardcode if on west-x, do not use on west-1
- `slb.ssc_image` UUID of SLB controller image
- `slb.ssc_package` Name of SLB controller package
- `slb.ssc_networks` Hardcode if on west-x, do not use on west-1
- `slb.ssc_datacenter` Datacenter for SSC machine, defaults to west-1
- `slb.account` Hardcode if on west-x, do not use on west-1
- `slb.ssc_protocol` Protocol to communicate with SLB controller
- `slb.ssc_port` Port to communicate with SLB controller
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
- `session.lifespan` Session timeout (in minutes)
- `showSLBObjects` Dev option to see SLB keys, images & machines
- `skinChange.url` Url for alternative beta/legacy skin, should be in format 'https://betaportal.joyent.com'
- `sso.url` Signle Sign-on service url
- `sso.keyIid` Your SSH key fingerprint in path format. ex: /{udrtnsmr}/keys/{fingerprint}
- `sso.keyPath` Full local path to your private key file
- `twitter.signupTag` Conversion tag to track user signups coming from Twitter Ads
- `usageData.userId` Test east-1 user for getting usage statistics, used if running in dev environment
- `usageData.key` Key used to access usage data in centralized manta account
- `usageData.keyId` Fingerprint of the key used to access usage data in centralized manta account
- `usageData.user` Username of manta user accessing centralized usage data
- `usageData.url` Url of manta holding centralized usage data
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

## Features

- `localSdc` Cumulative feature to adapt PIRANHA to local SDC usage
- `fullVersion` Show full revision in /version
- `instanceRename` Ability to rename machines
- `instanceTagging` Ability to tag machines
- `instanceMetadata` Ability to manage machine metadata
- `promocode` Promocodes support on signup
- `invoices` Display user invoices
- `imageUse` Allow to use private images
- `imageCreate` Allow to create private images
- `firewall` Cloud Firewall
- `skinChange` Allow to go from new design to old one and vice versa
- `useBrandingOrange` Use new design
- `promoBillingConfirmation` Confirm billing for support plan on signup
- `phoneVerification` Verify user phone on signup
- `freetier` Allow free machines for 1 year
- `manta` Joyent Manta
- `usageData` Display usage statistics
- `support` Allow to subscribe for Joyent Support packages
- `slb` Simple Load Balancer
- `createdBySupportPackages` Display and allow to signup for larger packages
- `uploadSshKey` Allow to upload user key
- `systemStatusTile` Display tile on dashboard
- `devCenterNewsTile` Display tile on dashboard
- `allowSkipBilling` User will skip lengthy signup and will be able to fill billing later
- `mantaJobs` Manage Manta jobs
- `recentInstances` Display recent images on provision
- `provisioningLimits` Respect and show provisioning limits set for user
- `mdb` Node.js debugger
- `rbac` Role Based Access Control
- `cloudAnalytics` Display analytics
- `downloadSdc` Page with links and description for local SDC
- `limitedSlb` Allow SLB for fixed customers list
- `cdn` Allow Fastly CDN
- `docker` Allow Docker integration
- `dockerMemoryLimit` Set minimum amout of RAM used to Docker mahcines
- `zendesk` Allow Zendesk/Zenbox integration
- `feedback` Show Feedback badge
- `blogEntries` Show recent Joyent Blog entries
- `marketo` Integrate with Marketo
- `twitter` Integrate with Twitter
- `googleAnalytics` Integrate with GA
- `billing` Allow user to enter/update his billing info

## Feature dependencies

Enabling `localSdc` feature will disable the following: `promocode`, `invoices`, `promoBillingConfirmation`,
`phoneVerification`, `freetier`, `slb`, `createdBySupportPackages`, `systemStatusTile`, `devCenterNewsTile`,
`downloadSdc`, `usageData`, `limitedSlb`, `support`, `skinChange`, `provisioningLimits`, `zendesk`, `feedback`,
`blogEntries`, `marketo`, `twitter`, `googleAnalytics`, `billing`. It will enable `allowSkipBilling`.

Disabling `zendesk` feature will disable `createdBySupportPackages`.

Disabling `billing` feature will disable `support`, `invoices`, `usageData`. It will enable `allowSkipBilling`.

## Common errors:

`Cannot find module {X}`
    You don't have module X and need to install it using `npm install {X}`.

`Invalid developer` message when logging in to the portal in the web browser.
    Your `sso.keyId` or `sso.keyPath` are wrong. Re-check them and make sure they are in SDC Admin. 

## Misc

### uncss

Install `gulp` and run:

    npm install --development
    npm install -g gulp
    cd tools
    gulp uncss

[1]:https://github.com/DeadAlready/node-easy-config
[2]:https://github.com/trentm/node-bunyan
[3]:https://github.com/joyent/node-express-modulizer
[4]:https://github.com/joyent/piranha-billing-server
[5]:https://github.com/angular/protractor
[6]:http://karma-runner.github.io/
