// GNU AGPL-3.0 License Copyright (c) 2021 - present core.ai . All rights reserved.

// jshint ignore: start
/*global localStorage, sessionStorage, crypto, analytics*/


if(!window.analytics){
    window.analytics = {
        _initData: [],
        debugMode: false
    };
}

if (typeof window.crypto === 'undefined'){
    window.crypto = {};
}

if (!('randomUUID' in crypto)){
    // https://stackoverflow.com/a/2117523/2800218
    // LICENSE: https://creativecommons.org/licenses/by-sa/4.0/legalcode
    crypto.randomUUID = function randomUUID() {
        return (
            [1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,
            // eslint-disable-next-line no-bitwise
            c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    };
}

/**
 * Initialize the analytics session
 * @param accountIDInit Your analytics account id as configured in the server or core.ai analytics
 * @param appNameInit The app name to log the events against.
 * @param analyticsURLInit Optional: Provide your own analytics server address if you self-hosted the server.
 * @param postIntervalSecondsInit Optional: This defines the interval between sending analytics events to the server.
 * Default is 1 minutes or server controlled.
 * @param granularitySecInit Optional: The smallest time period under which the events can be distinguished. Multiple
 * events happening during this time period is aggregated to a count. The default granularity is 3 Seconds or server
 * controlled, which means that any events that happen within 3 seconds cannot be distinguished in ordering.
 */
function initAnalyticsSession(accountIDInit, appNameInit, analyticsURLInit,
    postIntervalSecondsInit, granularitySecInit) {
    let accountID, appName, userID, sessionID, postIntervalSeconds,
        granularitySec, analyticsURL, postURL, serverConfig={};
    const DEFAULT_GRANULARITY_IN_SECONDS = 3;
    const DEFAULT_RETRY_TIME_IN_SECONDS = 30;
    const DEFAULT_POST_INTERVAL_SECONDS = 60; // 1 minutes
    const USERID_LOCAL_STORAGE_KEY = 'aicore.analytics.userID';
    const SESSION_ID_LOCAL_STORAGE_KEY = 'aicore.analytics.sessionID';
    const POST_LARGE_DATA_THRESHOLD_BYTES = 10000;
    let currentAnalyticsEvent = null;
    const IS_NODE_ENV = (typeof window === 'undefined');
    let DEFAULT_BASE_URL = "https://analytics.core.ai";

    let granularityTimer;
    let postTimer;
    let currentQuantisedTime = 0;
    let disabled = false;

    function debugLog(...args) {
        if(!window.analytics.debugMode){
            return;
        }
        console.log("analytics client: ", ...args);
    }

    function debugInfo(...args) {
        if(window.analytics.debugMode && window.analytics.debugInfoLogsEnable){
            console.info("analytics client: ", ...args);
        }
    }

    function debugError(...args) {
        if(!window.analytics.debugMode){
            return;
        }
        console.error("analytics client: ", ...args);
    }


    if(IS_NODE_ENV){
        throw new Error("Node environment is not currently supported");
    }

    function _createAnalyticsEvent() {
        return {
            schemaVersion: 1,
            accountID: accountID,
            appName: appName,
            uuid: userID,
            sessionID: sessionID,
            unixTimestampUTC: +new Date(),
            numEventsTotal: 0,
            events: {}
        };
    }

    function _validateCurrentState() {
        if(!currentAnalyticsEvent){
            throw new Error("Please call initSession before using any analytics event");
        }
    }

    function _getCurrentAnalyticsEvent() {
        _validateCurrentState();
        // return a clone
        return JSON.parse(JSON.stringify(currentAnalyticsEvent));
    }

    function _getOrCreateUserID() {
        let localUserID = localStorage.getItem(USERID_LOCAL_STORAGE_KEY);
        if(!localUserID){
            localUserID = crypto.randomUUID();
            localStorage.setItem(USERID_LOCAL_STORAGE_KEY, localUserID);
        }
        return localUserID;
    }

    function _getOrCreateSessionID() {
        let localSessionID = sessionStorage.getItem(SESSION_ID_LOCAL_STORAGE_KEY);
        if(!localSessionID){
            localSessionID = Math.random().toString(36).substr(2, 10);
            sessionStorage.setItem(SESSION_ID_LOCAL_STORAGE_KEY, localSessionID);
        }
        return localSessionID;
    }

    function _setupIDs() {
        userID = _getOrCreateUserID();
        sessionID = _getOrCreateSessionID();
    }

    function _retryPost(eventToSend) {
        eventToSend.backoffCount = (eventToSend.backoffCount || 0) + 1;
        debugLog(`Failed to call core analytics server. Will retry in ${
            DEFAULT_RETRY_TIME_IN_SECONDS * eventToSend.backoffCount}s: `);
        setTimeout(()=>{
            _postCurrentAnalyticsEvent(eventToSend);
        }, DEFAULT_RETRY_TIME_IN_SECONDS * 1000 * eventToSend.backoffCount);
    }

    function _postEventWithRetry(eventToSend) {
        let textToSend = JSON.stringify(eventToSend);
        if(textToSend.length > POST_LARGE_DATA_THRESHOLD_BYTES){
            console.warn(`Analytics event generated is very large at greater than ${textToSend.length}B. This 
        typically means that you may be sending too many value events? .`);
        }
        debugLog("Sending Analytics data of length: ", textToSend.length, "B");
        debugInfo("Sending data:", textToSend);
        if(!window.navigator.onLine){
            _retryPost(eventToSend);
            // chrome shows all network failure requests in console. In offline mode, we don't want to bomb debug
            // console with network failure messages for analytics. So we prevent network requests when offline.
            return;
        }
        window.fetch(postURL, {
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: textToSend
        }).then(res=>{
            if(res.status === 200){
                return;
            }
            if(res.status !== 400){ // we don't retry bad requests
                _retryPost(eventToSend);
            } else {
                console.error("Bad Request, this is most likely a problem with the library, update to latest version.");
            }
        }).catch(res => {
            debugError(res);
            _retryPost(eventToSend);
        });
    }

    function _postCurrentAnalyticsEvent(eventToSend) {
        if(disabled){
            return;
        }
        if(!eventToSend){
            eventToSend = currentAnalyticsEvent;
            currentQuantisedTime = 0;
            _resetGranularityTimer();
            currentAnalyticsEvent = _createAnalyticsEvent();
        }
        if(eventToSend.numEventsTotal === 0 ){
            return;
        }
        _postEventWithRetry(eventToSend);
    }

    function _resetGranularityTimer(disable) {
        if(granularityTimer){
            clearInterval(granularityTimer);
            granularityTimer = null;
        }
        if(disable){
            return;
        }
        granularityTimer = setInterval(()=>{
            currentQuantisedTime = currentQuantisedTime + granularitySec;
        }, granularitySec*1000);
    }

    function _setupTimers(disable) {
        _resetGranularityTimer(disable);
        if(postTimer){
            clearInterval(postTimer);
            postTimer = null;
        }
        if(disable){
            return;
        }
        postTimer = setInterval(_postCurrentAnalyticsEvent, postIntervalSeconds*1000);
    }

    function _getServerConfig() {
        return new Promise((resolve)=>{
            if(!window.navigator.onLine){
                resolve({});
                // chrome shows all network failure requests in console. In offline mode, we don't want to bomb debug
                // console with network failure messages for analytics. So we prevent network requests when offline.
                return;
            }
            let configURL = analyticsURL + `/getAppConfig?accountID=${accountID}&appName=${appName}`;
            window.fetch(configURL).then(res=>{
                switch (res.status) {
                case 200:
                    res.json().then(serverResponse =>{
                        resolve(serverResponse);
                    }).catch(err => {
                        debugError("remote response invalid. Continuing with defaults.", err);
                        resolve({});
                    });
                    return;
                case 400:
                    debugError("Bad Request, check library version compatible?", res);
                    resolve({});
                    break;
                default:
                    debugError("Could not update from remote config. Continuing with defaults.", res);
                    resolve({});
                }
            }).catch(err => {
                debugError("Could not update from remote config. Continuing with defaults.", err);
                resolve({});
            });
        });
    }

    /**
     * Returns the analytics config for the app
     * @returns {Object}
     */
    function _getAppConfig() {
        return {
            accountID, appName, disabled,
            uuid: userID, sessionID,
            postIntervalSeconds, granularitySec, analyticsURL, serverConfig
        };
    }

    function _initFromRemoteConfig(postIntervalSecondsInitial, granularitySecInitial) {
        _getServerConfig().then(updatedServerConfig =>{
            if(serverConfig !== {}){
                serverConfig = updatedServerConfig;
                // User init overrides takes precedence over server overrides
                postIntervalSeconds = postIntervalSecondsInitial ||
                    serverConfig["postIntervalSecondsInit"] || DEFAULT_POST_INTERVAL_SECONDS;
                granularitySec = granularitySecInitial || serverConfig["granularitySecInit"] || DEFAULT_GRANULARITY_IN_SECONDS;
                // For URLs, the server suggested URL takes precedence over user init values
                analyticsURL = serverConfig["analyticsURLInit"] || analyticsURL || DEFAULT_BASE_URL;
                disabled = serverConfig["disabled"] === true;
                _setupTimers(disabled);
                debugLog(`Init analytics Config from remote. disabled: ${disabled}
        postIntervalSeconds:${postIntervalSeconds}, granularitySec: ${granularitySec} ,URL: ${analyticsURL}`);
                if(disabled){
                    console.warn(`Core Analytics is disabled from the server for app: ${accountID}:${appName}`);
                }
            }
        });
    }

    function _stripTrailingSlash(url) {
        return url.toString().replace(/\/$/, "");
    }

    function _ensureAnalyticsEventExists(eventType, category, subCategory) {
        let events = currentAnalyticsEvent.events;
        events[eventType] = events[eventType] || {};
        events[eventType][category] = events[eventType][category] || {};
        events[eventType][category][subCategory] = events[eventType][category][subCategory] || {
            // quantised time
            time: [],
            // value and count array, If a single value, then it is count, else object {"val1":count1, ...}
            valueCount: []
        };
    }

    function _validateEvent(eventType, category, subCategory, count, value) {
        _validateCurrentState();
        if(!eventType || !category || !subCategory){
            throw new Error("missing eventType or category or subCategory");
        }
        if(typeof(count)!== 'number' || count <0){
            throw new Error("invalid count, count should be a positive number");
        }
        if(typeof(value)!== 'number'){
            throw new Error("invalid value, value should be a number");
        }
    }

    function _updateExistingAnalyticsEvent(index, eventType, category, subCategory, count, newValue) {
        let events = currentAnalyticsEvent.events;
        const storedValueIsCount = typeof(events[eventType][category][subCategory]["valueCount"][index]) === 'number';
        if(storedValueIsCount && newValue === 0){
            events[eventType][category][subCategory]["valueCount"][index] += count;
        } else if(storedValueIsCount && newValue !== 0){
            let newValueCount = {};
            newValueCount[newValue] = count;
            newValueCount[0] = events[eventType][category][subCategory]["valueCount"][index];
            events[eventType][category][subCategory]["valueCount"][index] = newValueCount;
        } else if(!storedValueIsCount){
            let storedValueObject = events[eventType][category][subCategory]["valueCount"][index];
            storedValueObject[newValue] = (storedValueObject[newValue] || 0) + count;
        }
        currentAnalyticsEvent.numEventsTotal += 1;
    }

    /**
     * Register an analytics event. The events will be aggregated and send to the analytics server periodically.
     * @param eventType - String, required
     * @param eventCategory - String, required
     * @param subCategory - String, required
     * @param eventCount (Optional) : A non-negative number indicating the number of times the event (or an event with a
     * particular value if a value is specified) happened. defaults to 1.
     * @param eventValue (Optional) : A number value associated with the event. defaults to 0
     */
    function event(eventType, eventCategory, subCategory, eventCount=1, eventValue=0) {
        if(disabled){
            return;
        }
        _validateEvent(eventType, eventCategory, subCategory, eventCount, eventValue);
        _ensureAnalyticsEventExists(eventType, eventCategory, subCategory);
        let events = currentAnalyticsEvent.events;
        let timeArray = events[eventType][eventCategory][subCategory]["time"];
        let lastTime = timeArray.length>0? timeArray[timeArray.length-1] : null;
        if(lastTime !== currentQuantisedTime){
            events[eventType][eventCategory][subCategory]["time"].push(currentQuantisedTime);
            if(eventValue===0){
                events[eventType][eventCategory][subCategory]["valueCount"].push(eventCount);
            } else {
                let valueCount = {};
                valueCount[eventValue] = eventCount;
                events[eventType][eventCategory][subCategory]["valueCount"].push(valueCount);
            }
            currentAnalyticsEvent.numEventsTotal += 1;
            return;
        }
        let modificationIndex = events[eventType][eventCategory][subCategory]["valueCount"].length -1;
        _updateExistingAnalyticsEvent(modificationIndex, eventType, eventCategory, subCategory, eventCount, eventValue);
    }

    // Init Analytics
    if(!accountIDInit || !appNameInit){
        throw new Error("accountID and appName must exist for init");
    }
    analyticsURL = analyticsURLInit? _stripTrailingSlash(analyticsURLInit) : DEFAULT_BASE_URL;
    accountID = accountIDInit;
    appName = appNameInit;
    postIntervalSeconds = postIntervalSecondsInit || DEFAULT_POST_INTERVAL_SECONDS;
    granularitySec = granularitySecInit || DEFAULT_GRANULARITY_IN_SECONDS;
    postURL = analyticsURL + "/ingest";
    _setupIDs();
    currentAnalyticsEvent = _createAnalyticsEvent();
    _setupTimers();
    _initFromRemoteConfig(postIntervalSecondsInit, granularitySecInit);

    // As analytics lib load is async, our loading scripts will push event data into initData array till the lib load
    // is complete. Now as load is done, we need to push these pending analytics events. Assuming that the async load of
    // the lib should mostly happen under a second, we should not lose any accuracy of event times within the initial
    // 3-second granularity. For more precision use cases, load the lib sync.
    for(let eventData of analytics._initData){
        event(...eventData);
    }
    analytics._initData = [];

    // Private API for tests
    analytics._getCurrentAnalyticsEvent = _getCurrentAnalyticsEvent;
    analytics._getAppConfig = _getAppConfig;

    // Public API
    analytics.event = event;
}
