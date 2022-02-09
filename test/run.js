// jshint ignore: start
/*global mocha*/
import './unit-test.spec.js';
import './unit-test-min.spec.js';

mocha.checkLeaks();
mocha.run();
