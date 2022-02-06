// jshint ignore: start
/*global describe, it, chai*/

import {
    getCurrentAnalyticsEvent,
    initSession
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

describe('core-analytics-client-lib main tests', function () {
    it('should throw if accountID and appID missing in init', function () {
        chai.expect(initSession).to.throw();
    });

    it('should getCurrentAnalyticsEvent throw if not inited', function () {
        chai.expect(getCurrentAnalyticsEvent).to.throw();
    });

    function _validateCurrentEvent(event, expectedEvent) {
        chai.expect(event.accountID).to.equal("acc1");
        chai.expect(event.appName).to.equal("app1");
        chai.expect(event.schemaVersion).to.equal(1);
        chai.expect(event.uuid).to.be.a("string");
        chai.expect(event.sessionID).to.be.a("string");
        chai.expect(event.granularitySec).to.be.equal(3);
        chai.expect(isTimestamp(event.unixTimestampUTC)).to.be.true;
        chai.expect(event.numEventsTotal).to.be.equal(0);
        chai.expect(event.events).to.eql(expectedEvent || {});
    }

    it('should getCurrentAnalyticsEvent succeed after init', function () {
        initSession("acc1", "app1");
        const event = getCurrentAnalyticsEvent();
        console.log(event);
        _validateCurrentEvent(event);
    });
});
