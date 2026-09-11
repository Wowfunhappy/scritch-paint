/* eslint-env jest */
import isRectangularBitmap from '../../src/helper/is-rectangular-bitmap';
import reducer, {setBitmapRectangular} from '../../src/reducers/bitmap-shape';

const bitmap = rows => ({
    width: rows[0].length,
    height: rows.length,
    data: new Uint8ClampedArray([].concat(...rows).reduce((pixels, alpha) => pixels.concat(0, 0, 0, alpha), []))
});

test.each([
    ['filled rectangle', [[255, 255], [255, 255]], true],
    ['transparent outside margins', [[0, 0, 0, 0], [0, 255, 255, 0], [0, 255, 255, 0], [0, 0, 0, 0]], true],
    ['empty image', [[0, 0], [0, 0]], false],
    ['rounded corners', [[0, 255, 0], [255, 255, 255], [0, 255, 0]], false],
    ['transparent interior hole', [[255, 255, 255], [255, 0, 255], [255, 255, 255]], false],
    ['partially erased edge', [[255, 255], [255, 0]], false],
    ['disconnected pieces', [[255, 0, 255]], false],
    ['semitransparent rectangle without gaps', [[128, 64], [32, 255]], true],
    ['single visible pixel', [[0, 0], [0, 255]], true]
])('%s', (name, rows, expected) => {
    expect(isRectangularBitmap(bitmap(rows))).toBe(expected);
});

test('eligibility defaults to disabled and tracks updates', () => {
    let initialState;
    expect(reducer(initialState, {type: 'initial'})).toBe(false);
    expect(reducer(false, setBitmapRectangular(true))).toBe(true);
    expect(reducer(true, setBitmapRectangular(false))).toBe(false);
    expect(reducer(true, {type: 'unrelated'})).toBe(true);
});
