/* eslint-env jest, browser */
import BackgroundRemover, {prepareInput, maskToAlpha, applyMask} from '../../src/helper/remove-background';

jest.mock('!!file-loader!../lib/background-removal/worker.js', () => 'worker.js', {virtual: true});
jest.mock('!!file-loader!../lib/background-removal/u2netp.onnx', () => 'model.onnx', {virtual: true});
jest.mock('!!../lib/background-removal/runtime-loader.js!../lib/background-removal/README.md', () => ({
    'ort.wasm.min.js': 'runtime.js', 'ort-wasm.wasm': 'plain.wasm', 'ort-wasm-simd.wasm': 'simd.wasm'
}), {virtual: true});
jest.mock('../../src/helper/layer', () => ({
    createCanvas: () => ({getContext: () => ({
        fillRect: jest.fn(),
        drawImage: jest.fn(),
        getImageData: () => ({data: new Uint8ClampedArray(320 * 320 * 4)})
    })})
}));

test('normalizes RGB into separate channels and handles black without NaNs', () => {
    const input = prepareInput(new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 0, 128]));
    expect(input[0]).toBeCloseTo((1 - 0.485) / 0.229);
    expect(input[3]).toBeCloseTo((1 - 0.456) / 0.224);
    expect(input[4]).toBeCloseTo(((128 / 255) - 0.406) / 0.225);
    expect(prepareInput(new Uint8ClampedArray(4)).every(Number.isFinite)).toBe(true);
});

test('normalizes mask and preserves ambiguous constant predictions', () => {
    expect(Array.from(maskToAlpha([0.2, 0.5, 0.8]))).toEqual([0, 127, 255]);
    expect(Array.from(maskToAlpha([0, 0]))).toEqual([255, 255]);
    expect(() => maskToAlpha([NaN])).toThrow();
});

test('preserves RGB and multiplies existing transparency by the predicted alpha', () => {
    const pixels = new Uint8ClampedArray([20, 30, 40, 128, 50, 60, 70, 0, 80, 90, 100, 255]);
    applyMask(pixels, [0, 0, 0, 128, 0, 0, 0, 255, 0, 0, 0, 0]);
    expect(Array.from(pixels)).toEqual([20, 30, 40, 64, 50, 60, 70, 0, 80, 90, 100, 0]);
});

test('cancellation stops the worker and rejects the pending operation', async () => {
    const worker = {postMessage: jest.fn(), terminate: jest.fn()};
    global.Worker = jest.fn(() => worker);
    global.document = {baseURI: 'http://localhost/'};
    const canvas = {width: 2, height: 2};
    const remover = new BackgroundRemover();
    const pending = remover.remove(canvas);
    remover.dispose();
    await expect(pending).rejects.toThrow('Cancelled');
    expect(worker.terminate).toHaveBeenCalled();
    delete global.Worker;
    delete global.document;
});
