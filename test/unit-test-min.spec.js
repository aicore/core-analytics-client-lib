// jshint ignore: start
/*global describe, it, chai, beforeEach, afterEach*/

import {
    getCurrentAnalyticsEvent,
    initSession,
    analyticsEvent,
    getAppConfig
} from "../dist/analytics.min.js";

/**
 * Determine whether string is timestamp
 *
 * @example
 *
 * isTimestamp('1606205966448'); // true
 * isTimestamp(1606205966448); // true
 * isTimestamp('1606205966448qwe'); // false
 * isTimestamp('2020-11-24T08:19:26.448Z'); // false
 *
 * @param {string|number} n
 * @returns {boolean}
 */
function isTimestamp(n) {
    const parsed = parseFloat(n);

    return !Number.isNaN(parsed) && Number.isFinite(parsed) && /^\d+\.?\d+$/.test(n);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

describe('core-analytics-client-lib `dist/analytics.min.js` minimised main tests', function () {
    let savedFetch = window.fetch;
    beforeEach(async function () {
        window.fetch = function (){
            return Promise.resolve({});
        };
    });

    afterEach(async function () {
        window.fetch = savedFetch;
    });

    it('should throw if accountID and appID missing in init', function () {
        chai.expect(initSession).to.throw();
    });

    it('should getCurrentAnalyticsEvent throw if not inited', function () {
        chai.expect(getCurrentAnalyticsEvent).to.throw();
    });

    function _validateCurrentEvent(event, eventCount=0, expectedEvent={}, granularity=3) {
        chai.expect(event.accountID).to.equal("unitTestAcc1");
        chai.expect(event.appName).to.equal("core-analytics-client-lib");
        chai.expect(event.schemaVersion).to.equal(1);
        chai.expect(event.uuid).to.be.a("string");
        chai.expect(event.sessionID).to.be.a("string");
        chai.expect(isTimestamp(event.unixTimestampUTC)).to.be.true;
        chai.expect(event.numEventsTotal).to.be.equal(eventCount);
        chai.expect(event.events).to.eql(expectedEvent);
    }

    it('should getCurrentAnalyticsEvent succeed after init', function () {
        initSession("unitTestAcc1", "core-analytics-client-lib");
        const event = getCurrentAnalyticsEvent();
        _validateCurrentEvent(event);
    });

    it('should fail analyticsEvent on invalid arguments', function () {
        initSession("unitTestAcc1", "core-analytics-client-lib");
        chai.expect(analyticsEvent).to.throw();
        chai.expect(()=>analyticsEvent('ev1', 'cat1', 'sub1', -1)).to.throw();
        chai.expect(()=>analyticsEvent('ev1', 'cat1', 'sub1', "10")).to.throw();
        chai.expect(()=>analyticsEvent('ev1', 'cat1', 'sub1', 1, "1"))
            .to.throw();
    });

    it('should analyticsEvent api succeed', async function () {
        initSession("unitTestAcc1", "core-analytics-client-lib", undefined, 10, .1);
        analyticsEvent('ev1', 'cat1', 'sub1');
        analyticsEvent('ev1', 'cat2', 'sub1', 5);
        await sleep(200);
        analyticsEvent('ev1', 'cat2', 'sub1', 2);
        const event = getCurrentAnalyticsEvent();
        _validateCurrentEvent(event, 3, {
            "ev1": {
                "cat1": {
                    "sub1": {
                        "time": [0],
                        "valueCount": [1]
                    }
                },
                "cat2": {
                    "sub1": {
                        "time": [0, 0.2],
                        "valueCount": [5, 2]
                    }
                }
            }
        }, .1);
    });

    it('should analyticsEvent api succeed if count and value is given subsequently', async function () {
        initSession("unitTestAcc1", "core-analytics-client-lib", undefined, 10, .1);
        analyticsEvent('ev1', 'cat1', 'sub1');
        analyticsEvent('ev1', 'cat2', 'sub1', 5);
        analyticsEvent('ev1', 'cat2', 'sub1', 5, 1);
        analyticsEvent('ev1', 'cat2', 'sub1', 2, 1);
        await sleep(200);
        analyticsEvent('ev1', 'cat2', 'sub1', 2);
        const event = getCurrentAnalyticsEvent();
        _validateCurrentEvent(event, 5, {
            "ev1": {
                "cat1": {
                    "sub1": {
                        "time": [0.2],
                        "valueCount": [1]
                    }
                },
                "cat2": {
                    "sub1": {
                        "time": [0.2, 0.4],
                        "valueCount": [
                            {
                                "0": 5,
                                "1": 7
                            },
                            2
                        ]
                    }
                }
            }
        }, .1);
    });

    it('should server override analytics config', async function () {
        window.fetch = function () {
            return Promise.resolve({
                "status": 200,
                json: function () {
                    return Promise.resolve({
                        "postIntervalSecondsInit": 4646,
                        "granularitySecInit": 53,
                        "analyticsURLInit": "https://lols",
                        "custom": {
                            "hello": "world"
                        }
                    });
                }
            });
        };
        initSession("unitTestAcc1", "core-analytics-client-lib");
        await sleep(100);
        let appConfig = getAppConfig();
        chai.expect(appConfig.postIntervalSeconds).to.eql(4646);
        chai.expect(appConfig.granularitySec).to.eql(53);
        chai.expect(appConfig.analyticsURL).to.eql("https://lols");
        chai.expect(appConfig.disabled).to.eql(false);
        chai.expect(appConfig.serverConfig.postIntervalSecondsInit).to.eql(4646);
        chai.expect(appConfig.serverConfig.granularitySecInit).to.eql(53);
        chai.expect(appConfig.serverConfig.analyticsURLInit).to.eql("https://lols");
        chai.expect(appConfig.serverConfig.custom).to.eql({"hello": "world"});
    });

    it('should not server override if user override specified in init analytics config', async function () {
        window.fetch = function () {
            return Promise.resolve({
                "status": 200,
                json: function () {
                    return Promise.resolve({
                        "postIntervalSecondsInit": 4646,
                        "granularitySecInit": 53,
                        "analyticsURLInit": "https://lols",
                        "custom": {
                            "hello": "world"
                        }
                    });
                }
            });
        };
        initSession("unitTestAcc1", "core-analytics-client-lib",
            "https://uyer", 45, 12);
        await sleep(100);
        let appConfig = getAppConfig();
        chai.expect(appConfig.postIntervalSeconds).to.eql(45);
        chai.expect(appConfig.granularitySec).to.eql(12);
        // Init URLs are  always server overriden
        chai.expect(appConfig.analyticsURL).to.eql("https://lols");
        chai.expect(appConfig.disabled).to.eql(false);
        chai.expect(appConfig.serverConfig.postIntervalSecondsInit).to.eql(4646);
        chai.expect(appConfig.serverConfig.granularitySecInit).to.eql(53);
        chai.expect(appConfig.serverConfig.analyticsURLInit).to.eql("https://lols");
        chai.expect(appConfig.serverConfig.custom).to.eql({"hello": "world"});
    });

    it('should work if no server override config present', async function () {
        window.fetch = function () {
            return Promise.resolve({
                "status": 200,
                json: function () {
                    return Promise.resolve({});
                }
            });
        };
        initSession("unitTestAcc1", "core-analytics-client-lib", "https://someURL");
        await sleep(100);
        let appConfig = getAppConfig();
        chai.expect(appConfig.postIntervalSeconds).to.eql(600);
        chai.expect(appConfig.granularitySec).to.eql(3);
        chai.expect(appConfig.disabled).to.eql(false);
        chai.expect(appConfig.analyticsURL).to.eql("https://someURL");
        chai.expect(appConfig.serverConfig).to.eql({});
    });

    it('should work if server override config call failed', async function () {
        window.fetch = function () {
            return Promise.reject({});
        };
        initSession("unitTestAcc1", "core-analytics-client-lib", "https://someURL");
        await sleep(100);
        let appConfig = getAppConfig();
        chai.expect(appConfig.postIntervalSeconds).to.eql(600);
        chai.expect(appConfig.granularitySec).to.eql(3);
        chai.expect(appConfig.disabled).to.eql(false);
        chai.expect(appConfig.analyticsURL).to.eql("https://someURL");
        chai.expect(appConfig.serverConfig).to.eql({});
    });

    it('should server config disable analytics', async function () {
        window.fetch = function () {
            return Promise.resolve({
                "status": 200,
                json: function () {
                    return Promise.resolve({
                        "disabled": true
                    });
                }
            });
        };
        initSession("unitTestAcc2", "core-analytics-client-lib", undefined, 10, .1);
        await sleep(200);
        analyticsEvent('ev1', 'cat1', 'sub1');
        analyticsEvent('ev1', 'cat2', 'sub1', 5);
        const event = getCurrentAnalyticsEvent();
        chai.expect(event.events).to.eql({});
    });
});
