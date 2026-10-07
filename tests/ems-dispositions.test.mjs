import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmsDispositions, formatEmsDispositions } from '../ems-dispositions.js';

test('older single selections and missing dispositions remain supported', () => {
    assert.deepEqual(getEmsDispositions('NO CREW/MA'), ['NO CREW/MA']);
    for (const value of [null, undefined, '', ' ; ']) {
        assert.deepEqual(getEmsDispositions(value), []);
        assert.equal(formatEmsDispositions(value), '');
    }
});

test('multiple selections survive saving and loading through the text/CSV field', () => {
    const selections = ['TRANSPORT', '2ND RUN', '76 COVERAGE'];
    const saved = formatEmsDispositions(selections);
    assert.equal(saved, 'TRANSPORT; 2ND RUN; 76 COVERAGE');
    assert.deepEqual(getEmsDispositions(saved), selections);
});

test('duplicates and whitespace do not inflate disposition counts', () => {
    assert.deepEqual(getEmsDispositions(' no crew/ma ; 2nd run ; NO CREW/MA ; '),
        ['NO CREW/MA', '2ND RUN']);
});

test('custom dispositions from imports remain available for editing', () => {
    assert.equal(formatEmsDispositions('LOCAL OUTCOME; TRANSPORT'), 'LOCAL OUTCOME; TRANSPORT');
});
