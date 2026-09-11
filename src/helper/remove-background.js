/* eslint-disable import/no-webpack-loader-syntax, import/no-unresolved */
import workerUrl from '!!file-loader!../lib/background-removal/worker.js';
import modelUrl from '!!file-loader!../lib/background-removal/u2netp.onnx';
import runtimeAssets from '!!../lib/background-removal/runtime-loader.js!../lib/background-removal/README.md';
import {createCanvas} from './layer';

const SIZE = 320;
const absoluteUrl = url => new URL(url, document.baseURI).href;

export const applyMask = (pixels, mask) => {
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = pixels[i] * mask[i] / 255;
};

// Match U²-NetP's RGB, CHW, maximum-value and ImageNet normalization.
export const prepareInput = pixels => {
    const count = pixels.length / 4;
    let maximum = 1;
    for (let i = 0; i < pixels.length; i += 4) {
        maximum = Math.max(maximum, pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    const input = new Float32Array(count * 3);
    const means = [0.485, 0.456, 0.406];
    const deviations = [0.229, 0.224, 0.225];
    for (let channel = 0; channel < 3; channel++) {
        for (let i = 0; i < count; i++) {
            input[(channel * count) + i] = ((pixels[(i * 4) + channel] / maximum) -
                means[channel]) / deviations[channel];
        }
    }
    return input;
};

export const maskToAlpha = mask => {
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const value of mask) {
        if (!Number.isFinite(value)) throw new Error('Invalid background mask');
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }
    // A constant prediction is ambiguous; preserve the image instead of erasing it.
    const range = maximum - minimum;
    return Uint8ClampedArray.from(mask, value => (range > 1e-6 ?
        255 * (value - minimum) / range : 255));
};

export default class BackgroundRemover {
    remove (canvas) {
        const resized = createCanvas(SIZE, SIZE);
        const context = resized.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, SIZE, SIZE);
        context.imageSmoothingEnabled = true;
        context.drawImage(canvas, 0, 0, SIZE, SIZE);
        const input = prepareInput(context.getImageData(0, 0, SIZE, SIZE).data);
        if (!this.worker) this.worker = new Worker(absoluteUrl(workerUrl));
        return new Promise((resolve, reject) => {
            this.reject = reject;
            this.worker.onerror = () => reject(new Error('Background removal worker failed'));
            this.worker.onmessage = ({data}) => {
                if (data.error) return reject(new Error(data.error));
                try {
                    if (data.mask.length !== SIZE * SIZE) throw new Error('Invalid mask size');
                    const alpha = maskToAlpha(data.mask);
                    const mask = context.createImageData(SIZE, SIZE);
                    for (let i = 0; i < alpha.length; i++) mask.data[(i * 4) + 3] = alpha[i];
                    context.putImageData(mask, 0, 0);
                    const result = createCanvas(canvas.width, canvas.height);
                    const resultContext = result.getContext('2d');
                    resultContext.drawImage(canvas, 0, 0);
                    const pixels = resultContext.getImageData(0, 0, canvas.width, canvas.height);
                    resultContext.clearRect(0, 0, canvas.width, canvas.height);
                    resultContext.imageSmoothingEnabled = true;
                    resultContext.drawImage(resized, 0, 0, canvas.width, canvas.height);
                    applyMask(pixels.data, resultContext.getImageData(0, 0, canvas.width, canvas.height).data);
                    resultContext.putImageData(pixels, 0, 0);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            this.worker.postMessage({
                input,
                modelUrl: absoluteUrl(modelUrl),
                runtimeUrl: absoluteUrl(runtimeAssets['ort.wasm.min.js']),
                wasmPaths: {
                    'ort-wasm.wasm': absoluteUrl(runtimeAssets['ort-wasm.wasm']),
                    'ort-wasm-simd.wasm': absoluteUrl(runtimeAssets['ort-wasm-simd.wasm'])
                }
            }, [input.buffer]);
        });
    }
    dispose () {
        if (this.worker) this.worker.terminate();
        this.worker = null;
        if (this.reject) this.reject(new Error('Cancelled'));
        this.reject = null;
    }
}
