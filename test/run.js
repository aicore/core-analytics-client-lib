// jshint ignore: start
/*global mocha*/
import './unit-test.spec.js';

mocha.checkLeaks();
mocha.run();
