/*
 * GNU AGPL-3.0 License
 *
 * Copyright (c) 2021 - present core.ai . All rights reserved.
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see https://opensource.org/licenses/AGPL-3.0.
 *
 */

// jshint ignore: start
/*global localStorage, sessionStorage, crypto*/

let accountID, appName, userID, sessionID, postIntervalSeconds, granularitySec;
const DEFAULT_GRANULARITY_IN_SECONDS = 3;
const DEFAULT_POST_INTERVAL_SECONDS = 600; // 10 minutes
const USERID_LOCAL_STORAGE_KEY = 'aicore.analytics.userID';
let currentAnalyticsEvent = null;
const IS_NODE_ENV = (typeof window === 'undefined');

if(IS_NODE_ENV){
    throw new Error("Node environment is not currently supported");
}

function _createAnalyticsEvent() {
    return {
        "schemaVersion": 1,
        "accountID": accountID,
        "appName": appName,
        "uuid": userID,
        "sessionID": sessionID,
        "granularitySec": granularitySec,
        "unixTimestampUTC": +new Date(),
        "numEventsTotal": 0,
        "events": {}
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

/**
 * Initialize the analytics session
 * @param accountIDInit Your analytics account id as configured in the server or core.ai analytics
 * @param appNameInit The app name to log the events against.
 * @param postIntervalSecondsInit Optional: This defines the interval between sending analytics events to the server.
 * Default is 10 minutes
 * @param granularitySecInit Optional: The smallest time period under which the events can be distinguished. Multiple
 * events happening during this time period is aggregated to a count. The default granularity is 3 Seconds, which means
 * that any events that happen within 3 seconds cannot be distinguished in ordering.
 */
function initSession(accountIDInit, appNameInit, postIntervalSecondsInit, granularitySecInit) {
    if(!accountIDInit || !appNameInit){
        throw new Error("accountID and appName must exist for init");
    }
    accountID = accountIDInit;
    appName = appNameInit;
    postIntervalSeconds = postIntervalSecondsInit || DEFAULT_POST_INTERVAL_SECONDS;
    granularitySec = granularitySecInit || DEFAULT_GRANULARITY_IN_SECONDS;
    _setupIDs();
    currentAnalyticsEvent = _createAnalyticsEvent();
}

export {
    initSession,
    getCurrentAnalyticsEvent
};
