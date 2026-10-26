const test = require('node:test');
const assert = require('node:assert/strict');
const { getCropRect, fitOutput } = require('../photo-crop-math.js');

test('a centered square crop uses the full short edge', () => {
    assert.deepEqual(getCropRect({ width: 1200, height: 800, aspect: 1, zoom: 1, panX: .5, panY: .5 }), { x: 200, y: 0, width: 800, height: 800 });
});
test('zoom preserves the center while narrowing the source rectangle', () => {
    assert.deepEqual(getCropRect({ width: 1200, height: 800, aspect: 1, zoom: 2, panX: .5, panY: .5 }), { x: 400, y: 200, width: 400, height: 400 });
});
test('portrait crops clamp extreme drags inside the original image', () => {
    assert.deepEqual(getCropRect({ width: 1000, height: 2000, aspect: .8, zoom: 1, panX: -50, panY: 50 }), { x: 0, y: 750, width: 1000, height: 1250 });
});
test('zoom cannot reveal empty canvas or exceed four times', () => {
    assert.deepEqual(getCropRect({ width: 800, height: 800, aspect: 1, zoom: -2, panX: 0, panY: 0 }), { x: 0, y: 0, width: 800, height: 800 });
    assert.deepEqual(getCropRect({ width: 800, height: 800, aspect: 1, zoom: 100, panX: 1, panY: 1 }), { x: 600, y: 600, width: 200, height: 200 });
});
test('invalid image geometry is rejected', () => {
    for (const width of [0, -1, NaN, Infinity]) assert.throws(() => getCropRect({ width, height: 500, aspect: 1 }), /dimensions/i);
    assert.throws(() => getCropRect({ width: 500, height: 500, aspect: 0 }), /dimensions/i);
});
test('exports cap the long edge and never enlarge a small crop', () => {
    assert.deepEqual(fitOutput({ width: 4000, height: 3000 }, 2200), { width: 2200, height: 1650 });
    assert.deepEqual(fitOutput({ width: 200, height: 250 }, 2200), { width: 200, height: 250 });
});
