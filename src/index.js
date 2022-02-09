// GNU AGPL-3.0 License Copyright (c) 2021 - present core.ai . All rights reserved.

// jshint ignore: start
/*global localStorage, sessionStorage, crypto*/

let accountID, appName, userID, sessionID, postIntervalSeconds, granularitySec, postURL;
const DEFAULT_GRANULARITY_IN_SECONDS = 3;
const DEFAULT_RETRY_TIME_IN_SECONDS = 30;
const DEFAULT_POST_INTERVAL_SECONDS = 600; // 10 minutes
const USERID_LOCAL_STORAGE_KEY = 'aicore.analytics.userID';
const POST_LARGE_DATA_THRESHOLD_BYTES = 10000;
let currentAnalyticsEvent = null;
const IS_NODE_ENV = (typeof window === 'undefined');
let DEFAULT_BASE_URL = "https://analytics.core.ai";

let granularityTimer;
let postTimer;
let currentQuantisedTime = 0;

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
        granularitySec: granularitySec,
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

function getCurrentAnalyticsEvent() {
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
    let localSessionID = sessionStorage.getItem(USERID_LOCAL_STORAGE_KEY);
    if(!localSessionID){
        localSessionID = Math.random().toString(36).substr(2, 10);
        sessionStorage.setItem(USERID_LOCAL_STORAGE_KEY, localSessionID);
    }
    return localSessionID;
}

function _setupIDs() {
    userID = _getOrCreateUserID();
    sessionID = _getOrCreateSessionID();
}

function _retryPost(eventToSend) {
    eventToSend.backoffCount = (eventToSend.backoffCount || 0) + 1;
    console.log(`Failed to call core analytics server. Will retry in ${
        DEFAULT_RETRY_TIME_IN_SECONDS * eventToSend.backoffCount}s: `);
    setTimeout(()=>{
        _postCurrentAnalyticsEvent(eventToSend);
    }, DEFAULT_RETRY_TIME_IN_SECONDS * 1000 * eventToSend.backoffCount);
}

function _postCurrentAnalyticsEvent(eventToSend) {
    if(!eventToSend){
        eventToSend = currentAnalyticsEvent;
        currentAnalyticsEvent = _createAnalyticsEvent();
    }
    if(eventToSend.numEventsTotal === 0 ){
        return;
    }
    let textToSend = JSON.stringify(eventToSend);
    if(textToSend.length > POST_LARGE_DATA_THRESHOLD_BYTES){
        console.warn(`Analytics event generated is very large at greater than ${textToSend.length}B. This 
        typically means that you may be sending too many value events? .`);
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
        console.error(res);
        _retryPost(eventToSend);
    });
}

function _setupTimers() {
    if(granularityTimer){
        clearInterval(granularityTimer);
        granularityTimer = null;
    }
    granularityTimer = setInterval(()=>{
        currentQuantisedTime = currentQuantisedTime + granularitySec;
    }, granularitySec*1000);

    if(postTimer){
        clearInterval(postTimer);
        postTimer = null;
    }
    postTimer = setInterval(_postCurrentAnalyticsEvent, postIntervalSeconds*1000);
}

/**
 * Initialize the analytics session
 * @param accountIDInit Your analytics account id as configured in the server or core.ai analytics
 * @param appNameInit The app name to log the events against.
 * @param postIntervalSecondsInit Optional: This defines the interval between sending analytics events to the server.
 * Default is 10 minutes
 * @param granularitySecInit Optional: The smallest time period under which the events can be distinguished. Multiple
 * events happening during this time period is aggregated to a count. The default granularity is 3 Seconds, which means
 * that any events that happen within 3 seconds cannot be distinguished in ordering.
 * @param postBaseURLInit Optional: Provide your own analytics server address if you self-hosted the server
 */
function initSession(accountIDInit, appNameInit, postIntervalSecondsInit, granularitySecInit, postBaseURLInit) {
    if(!accountIDInit || !appNameInit){
        throw new Error("accountID and appName must exist for init");
    }
    accountID = accountIDInit;
    appName = appNameInit;
    postIntervalSeconds = postIntervalSecondsInit || DEFAULT_POST_INTERVAL_SECONDS;
    granularitySec = granularitySecInit || DEFAULT_GRANULARITY_IN_SECONDS;
    postURL = (postBaseURLInit || DEFAULT_BASE_URL) + "/ingest";
    _setupIDs();
    currentAnalyticsEvent = _createAnalyticsEvent();
    _setupTimers();
}

function _ensureAnalyticsEventExists(eventType, category, subCategory) {
    let events = currentAnalyticsEvent.events;
    events[eventType] = events[eventType] || {};
    events[eventType][category] = events[eventType][category] || {};
    events[eventType][category][subCategory] = events[eventType][category][subCategory] || {
        time: [], // quantised time
        valueCount: [] // value and count array, If a single value, then it is count, else object {"val1":count1, ...}
    };
}

function _validateEvent(eventType, category, subCategory, count, value) {
    _validateCurrentState();
    if(!eventType || !category || !subCategory){
        throw new Error("missing eventType or category or subCategory");
    }
    if(typeof(count)!== 'number' || count <0){
        throw new Error("invalid count");
    }
    if(typeof(value)!== 'number'){
        throw new Error("invalid value");
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
function analyticsEvent(eventType, eventCategory, subCategory, eventCount=1, eventValue=0) {
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

export {
    initSession,
    getCurrentAnalyticsEvent,
    analyticsEvent
};
