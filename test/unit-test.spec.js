// jshint ignore: start
/*global describe, it, chai*/

import {
    getCurrentAnalyticsEvent,
    initSession,
    incrementEventCount
} from "../src/index.js";

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

describe('core-analytics-client-lib main tests', function () {
    it('should throw if accountID and appID missing in init', function () {
        chai.expect(initSession).to.throw();
    });

    it('should getCurrentAnalyticsEvent throw if not inited', function () {
        chai.expect(getCurrentAnalyticsEvent).to.throw();
    });

    function _validateCurrentEvent(event, eventCount=0, expectedEvent={}, granularity=3) {
        chai.expect(event.accountID).to.equal("acc1");
        chai.expect(event.appName).to.equal("app1");
        chai.expect(event.schemaVersion).to.equal(1);
        chai.expect(event.uuid).to.be.a("string");
        chai.expect(event.sessionID).to.be.a("string");
        chai.expect(event.granularitySec).to.be.equal(granularity);
        chai.expect(isTimestamp(event.unixTimestampUTC)).to.be.true;
        chai.expect(event.numEventsTotal).to.be.equal(eventCount);
        chai.expect(event.events).to.eql(expectedEvent);
    }

    it('should getCurrentAnalyticsEvent succeed after init', function () {
        initSession("acc1", "app1");
        const event = getCurrentAnalyticsEvent();
        _validateCurrentEvent(event);
    });

    it('should incrementEventCount succeed', async function () {
        initSession("acc1", "app1", 10, .1);
        incrementEventCount('ev1', 'cat1', 'sub1');
        incrementEventCount('ev1', 'cat2', 'sub1', 5);
        await sleep(200);
        incrementEventCount('ev1', 'cat2', 'sub1', 2);
        const event = getCurrentAnalyticsEvent();
        console.log(event);
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
});
