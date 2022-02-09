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

## Initialize the session
Embed the script in your HTML file : 
```html
<html lang="en">
<script type="module">
    // For production use cases, use url: https://unpkg.com/@aicore/core-analytics-client-lib/dist/analytics.min.js
    // The below url is for development purposes only.
    import {initSession} from "https://unpkg.com/@aicore/core-analytics-client-lib/src/analytics.js";
    initSession("accountID", "appName");
</script>
</html>
```

initSession(): Initialize the analytics session. It takes the following parameters:

* `accountID`: Your analytics account id as configured in the server or core.ai analytics
* `appName`: The app name to log the events against. Eg: "phoenixCode"
* `postIntervalSeconds` (_Optional_): This defines the interval between sending analytics events to the server. Default is 10 minutes
* `granularitySec` (_Optional_): The smallest time period under which the events can be distinguished. Multiple
events happening during this time period is aggregated to a count. The default granularity is 3 Seconds, which means
that any events that happen within 3 seconds cannot be distinguished in ordering.
* `postBaseURLInit` Optional: Provide your own analytics server address if you self-hosted the server

```javascript
// Example for custom initSession where the analytics aggregated data 
// is posted to custom server https://localhost:3000 every 600 secs
// with a granularity(resolution) of 5 seconds.

initSession("accountID", "appName", 600, 5, "https://localhost:3000");
```

## Raising analytics events
Once `initSession` is called, we can now start logging analytics events by calling `analyticsEvent` API.
The API registers an analytics event. The events will be aggregated and send to the analytics server periodically.

```javascript
// analyticsEvent(eventType, eventCategory, subCategory, eventCount, eventValue);

// Eg: event without counts and values
analyticsEvent("platform", "os", "linux");

// Eg: event with count, here it logs that html file is opened 100 times
analyticsEvent("file", "opened", "html", 100);

// Eg: event with count and value, here it logs that the startup time is 250 milliseconds. 
// Note that the value is unitless from analytics perspective. unit is deduced from subCategory name
analyticsEvent("platform", "performance", "startupTimeMs", 1, 250);

// Eg: event with fractional value.
analyticsEvent("platform", "CPU", "utilization", 1, .45);
// Eg. Here we register that the system has 8 cores with each core having 2300MHz frequency.
analyticsEvent("platform", "CPU", "coreCountsAndFrequencyMhz", 8, 2300);
```
### API parameters
* `eventType` - A string, required
* `eventCategory` - A string, required
* `subCategory` - A string, required
* `eventCount` (_Optional_) : A non-negative number indicating the number of times the event (or an event with a
particular value if a value is specified) happened. defaults to 1.
* `eventValue` (_Optional_) : A number value associated with the event. defaults to 0

# Contribute to core-analytics-client-lib

## Building
Since this is a pure JS template project, build command just runs test with coverage.
```shell
> npm install   # do this only once.

# Before raising a pull request, run release script and add the generated
# minified files in dist folder to commits .
# WARNING!!!: If the minified files are not checkedin git push will fail. 
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
