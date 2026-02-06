# Core Analytics Client Lib - JS
The Javascript client library to be used from browser/nodejs to raise analytics
events for [Core-Analytics-Server](https://github.com/aicore/Core-Analytics-Server).

## Code Guardian
[![<app> build verification](https://github.com/aicore/core-analytics-client-lib/actions/workflows/build_verify.yml/badge.svg)](https://github.com/aicore/core-analytics-client-lib/actions/workflows/build_verify.yml)

<a href="https://sonarcloud.io/summary/new_code?id=aicore_core-analytics-client-lib">
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=alert_status" alt="Sonar code quality check" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=security_rating" alt="Security rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=vulnerabilities" alt="vulnerabilities" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=coverage" alt="Code Coverage" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=bugs" alt="Code Bugs" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=reliability_rating" alt="Reliability Rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=sqale_rating" alt="Maintainability Rating" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=ncloc" alt="Lines of Code" />
  <img src="https://sonarcloud.io/api/project_badges/measure?project=aicore_core-analytics-client-lib&metric=sqale_index" alt="Technical debt" />
</a>

# Usage

## Load the Library
Embed the script in your HTML file and replace `your_analytics_account_ID` and `appName`
in the `initAnalyticsSession` call below: 
```html
<!-- Global window.analytics object - core.ai analytics services -->
<script async src="https://unpkg.com/@aicore/core-analytics-client-lib/src/analytics.js"
        onload="analyticsLibLoaded()"></script>
<script>
    if(!window.analytics){ window.analytics = {
        _initData : [], loadStartTime: new Date().getTime(),
        event: function (){window.analytics._initData.push(arguments);}
    };}
    function analyticsLibLoaded() {
        initAnalyticsSession('your_analytics_account_ID', 'appName');
        analytics.valueEvent("core-analytics", "client-lib", "loadTime", (new Date().getTime())-analytics.loadStartTime);
    }
</script>
```
This will create a global `analytics` variable which can be used to access the analytics APIs. 

NB: The script is loaded async, so it will not block other js scripts. `analytics.event` api can be called anytime
after the above code and need not wait for the script load to complete.

## Raising analytics events
Events are aggregated and sent to the analytics server periodically.
Two APIs are available depending on your use case:

### `analytics.countEvent` - Count occurrences
Use this to track how many times something happens.

```javascript
// countEvent(eventType, eventCategory, subCategory, eventCount)

// Count a single occurrence
analytics.countEvent("platform", "os", "linux");

// Count multiple occurrences at once (e.g., html file opened 100 times)
analytics.countEvent("file", "opened", "html", 100);
```

#### Parameters
* `eventType` - A string, required
* `eventCategory` - A string, required
* `subCategory` - A string, required
* `eventCount` (_Optional_) : A non-negative number indicating the number of times the event happened. Defaults to 1.

### `analytics.valueEvent` - Track values
Use this to measure quantities like latencies, durations, sizes, or anything where you need
running averages and distributions.

```javascript
// valueEvent(eventType, eventCategory, subCategory, eventValue, count)

// Track startup time of 250 milliseconds
// Note that the value is unitless from analytics perspective. Unit is deduced from subCategory name.
analytics.valueEvent("platform", "performance", "startupTimeMs", 250);

// Track fractional values (e.g., CPU utilization)
analytics.valueEvent("platform", "CPU", "utilization", .45);

// Track that a system has 8 cores with each core having 2300MHz frequency
analytics.valueEvent("platform", "CPU", "coreCountsAndFrequencyMhz", 2300, 8);
```

#### Parameters
* `eventType` - A string, required
* `eventCategory` - A string, required
* `subCategory` - A string, required
* `eventValue` (_Optional_) : A numeric value associated with the event. Defaults to 0.
* `count` (_Optional_) : A non-negative number indicating how many times this value occurred. Defaults to 1.

### Deprecated: `analytics.event`
The legacy `analytics.event(eventType, eventCategory, subCategory, eventCount, eventValue)` API is still
available for backwards compatibility but is deprecated. Please migrate to `countEvent` or `valueEvent`.


## Advanced Usages

### Pure JS loading instead of HTML scripts

There may be cases where you would want to load the script from JS alone. For Eg. you
may want to delay library loading till user consents GDPR. For such use cases, use the below code.

```js
function _initCoreAnalytics() {
    // Load core analytics scripts
    if(!window.analytics){ window.analytics = {
        _initData: [], loadStartTime: new Date().getTime(),
        event: function (){window.analytics._initData.push(arguments);}
    };}
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.onload = function(){
        // replace `your_analytics_account_ID` and `appName` below with your values
        window.initAnalyticsSession('your_analytics_account_ID', 'appName'); // if you have a custom analytics server
        window.analytics.valueEvent("core-analytics", "client-lib", "loadTime",
            (new Date().getTime())- window.analytics.loadStartTime);
    };
    script.src = 'https://unpkg.com/@aicore/core-analytics-client-lib/dist/analytics.min.js';
    document.getElementsByTagName('head')[0].appendChild(script);
}
_initCoreAnalytics();
```
To load the library, just call `_initCoreAnalytics()` from JS. Note that you may not be able
to use `analytics.event()` APIs before `_initCoreAnalytics()` call is made.

### initAnalyticsSession: modify when, where and how analytics lib sends events
 If you want to modify how analytics library collects and sends information, it is recommended to do so
with analytics server [accountConfig](https://github.com/aicore/Core-Analytics-Server#accountconfig-configuration).

Alternatively for one off development time uses, the behavior of the library can be configured
during the `initAnalyticsSession` call. `initAnalyticsSession()` takes the following parameters:

* `accountID`: Your analytics account id as configured in the server or core.ai analytics
* `appName`: The app name to log the events against. Eg: "phoenixCode"
* `analyticsURL` (_Optional_): Provide your own analytics server address if you self-hosted the server.
* `postIntervalSeconds` (_Optional_): This defines the interval between sending analytics events to the server. Default is 1 minutes or server controlled.
* `granularitySec` (_Optional_): The smallest time period under which the events can be distinguished. Multiple
events happening during this time period is aggregated to a count. The default granularity is 3 Seconds or server controlled,
which means that any events that happen within 3 seconds cannot be distinguished in ordering.

#### usageExample
```javascript
// Init with default values and server controlled config. use the following `analyticsLibLoaded` function
function analyticsLibLoaded() {
    initAnalyticsSession('your_analytics_account_ID', 'appName');
    analytics.valueEvent("core-analytics", "client-lib", "loadTime", (new Date().getTime())-analytics.loadStartTime);
}

//Replace initAnalyticsSession in analyticsLibLoaded function for the below use cases.

// Example for custom initSession where the analytics aggregated data 
// is posted to custom server https://localhost:3000 every 600 secs
// with a granularity(resolution) of 5 seconds.
initAnalyticsSession("accountID", "appName", "https://localhost:3000", 600, 5);
```

### Debug logs
 If you want to see detailed logs on what is happening inside analytics lib, use the below code:
```js
// Just before initAnalyticsSession call, set or unset window.analytics.debugMode
window.analytics.debugMode = true;
initAnalyticsSession("accountID", "appName");
```

# Contribute to core-analytics-client-lib

## Building
Since this is a pure JS template project, build command just runs test with coverage.
```shell
> npm install   # do this only once.

# Before raising a pull request, run release script and add the generated
# minified files in dist folder to commits .
# WARNING!!!: If the minified files are not checked in git push will fail. 
> npm run release
```

## Linting
To lint the files in the project, run the following command:
```shell
> npm run lint
```
To Automatically fix lint errors:
```shell
> npm run lint:fix
```

## Testing
To run tests, open the file `test/unit-test.html` in the browser.

# Publishing packages to NPM
To publish a package to npm, raise a pull request against `npm` branch.

# Dependency updates
  We use Rennovate for dependency updates: https://blog.logrocket.com/renovate-dependency-updates-on-steroids/
  * By default, dep updates happen on sunday every week.
  * The status of dependency updates can be viewed here if you have this repo permissions in github: https://app.renovatebot.com/dashboard#github/aicore/template-nodejs
  * To edit rennovate options, edit the rennovate.json file in root, see https://docs.renovatebot.com/configuration-options/
  Refer 
  
# Code Guardian
Several automated workflows that check code integrity are integrated into this template.
These include:
1. GitHub actions that runs build/test/coverage flows when a contributor raises a pull request
2. [Sonar cloud](https://sonarcloud.io/) integration using `.sonarcloud.properties`
   1. In sonar cloud, enable Automatic analysis from `Administration
      Analysis Method` for the first time ![image](https://user-images.githubusercontent.com/5336369/148695840-65585d04-5e59-450b-8794-54ca3c62b9fe.png)

## IDE setup
SonarLint is currently available as a free plugin for jetbrains, eclipse, vscode and visual studio IDEs.
Use sonarLint plugin for webstorm or any of the available
IDEs from this link before raising a pull request: https://www.sonarlint.org/ .

SonarLint static code analysis checker is not yet available as a Brackets
extension.

## Internals
### Testing framework: Mocha , assertion style: chai
 See https://mochajs.org/#getting-started on how to write tests
 Use chai for BDD style assertions (expect, should etc..). See move here: https://www.chaijs.com/guide/styles/#expect
