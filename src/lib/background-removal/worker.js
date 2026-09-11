/* global importScripts, ort */
// Kept outside the editor bundle: inference must never block drawing or input.
let session;
self.onmessage = async ({data}) => {
    try {
        if (!session) {
            importScripts(data.runtimeUrl);
            ort.env.wasm.wasmPaths = data.wasmPaths;
            // Works without SharedArrayBuffer / cross-origin isolation, even on older devices.
            ort.env.wasm.numThreads = 1;
            session = ort.InferenceSession.create(data.modelUrl, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });
        }
        const ready = await session;
        const input = new ort.Tensor('float32', data.input, [1, 3, 320, 320]);
        const outputs = await ready.run({[ready.inputNames[0]]: input}, [ready.outputNames[0]]);
        const output = outputs[ready.outputNames[0]];
        const mask = new Float32Array(output.data);
        input.dispose();
        output.dispose();
        self.postMessage({mask}, [mask.buffer]);
    } catch (error) {
        self.postMessage({error: String(error)});
    }
};
