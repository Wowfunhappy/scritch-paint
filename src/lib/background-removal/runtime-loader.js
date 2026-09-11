// Emit the browser distribution without importing its code or relying on
// private package subpath exports (which webpack 5 correctly rejects).
/* eslint-disable import/no-commonjs, import/no-nodejs-modules */
/* eslint-env node */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function () {
    for (const license of ['LICENSE-U2NET', 'LICENSE-ONNXRUNTIME']) {
        const filename = path.join(__dirname, license);
        this.addDependency(filename);
        this.emitFile(`background-removal/${license}`, fs.readFileSync(filename));
    }
    const directory = path.dirname(require.resolve('onnxruntime-web'));
    const assets = ['ort.wasm.min.js', 'ort-wasm.wasm', 'ort-wasm-simd.wasm'];
    const entries = assets.map(name => {
        const filename = path.join(directory, name);
        this.addDependency(filename);
        const content = fs.readFileSync(filename);
        const hash = crypto.createHash('sha256').update(content)
            .digest('hex')
            .slice(0, 16);
        const emitted = `background-removal/${hash}-${name}`;
        this.emitFile(emitted, content);
        return `${JSON.stringify(name)}: __webpack_public_path__ + ${JSON.stringify(emitted)}`;
    });
    return `module.exports = {${entries.join(',')}};`;
};
