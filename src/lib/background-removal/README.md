# Local background removal

The bitmap editor uses U²-NetP (320 × 320 input), the small U²-Net variant,
with ONNX Runtime Web 1.17.3. It prioritizes low model size and CPU work over
fine-edge quality. Model weights are about 4.6 MB; the browser also loads a
roughly 10 MB WebAssembly runtime on first use. Nothing is uploaded.

Inference runs in a dedicated worker using single-threaded WASM, with SIMD
where supported. This requires no GPU, server, or cross-origin isolation.
The session is reused until cancellation, a costume switch or editor unmount releases it.
Assets are emitted by webpack and served from the application's own origin.
They are fetched only on use; offline use requires those assets to be cached
or served locally. Deploy the emitted .onnx, .wasm and worker/runtime .js files
along with the application bundles. CSP must permit same-origin workers,
scripts and fetches, plus WebAssembly compilation.

Source and licensing:

- U²-Net: https://github.com/xuebinqin/U-2-Net (Apache-2.0).
- ONNX export distributed by rembg (MIT):
  https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
- Model MD5, verified against rembg's U2netpSession:
  `8e83ca70e441ab06c318d82300c84806`.
- ONNX Runtime: https://github.com/microsoft/onnxruntime (MIT).

Transparent margins are cropped for inference, then the predicted alpha mask
is scaled to the original artwork and multiplied with its existing alpha.
The bitmap's position and resolution stay intact. Successful removal uses the
normal image update/undo path. Edits, costume switches and cancellation discard
pending results; no speed guarantee has been established on slower hardware.

The button is enabled only when nontransparent pixels fill an axis-aligned
rectangle. Outer transparent margins are ignored; holes, erased gaps and rounded
corners disable it. Partially transparent pixels still count as visible. The
check runs on import and exported bitmap updates (including Undo/Redo and
floating selections), and is repeated on the committed bitmap before inference.
