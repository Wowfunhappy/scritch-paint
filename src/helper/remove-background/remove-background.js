import imglyRemoveBackground from "@imgly/background-removal"
import { getRaster } from '../layer';

import * as ort from 'onnxruntime-web';
import * as ortc from 'onnxruntime-common';

const removeImageBackground = function (onUpdateImage) {
	console.log(ort);
	console.log(ortc);
	
	const inBlob = getRaster().source;
	
	if (!ort.env) {
		ort.env = ortc.env;
	}
	if (!ort.InferenceSession) {
		ort.InferenceSession = ortc.InferenceSession;
	}
	
	imglyRemoveBackground(inBlob, {
		publicPath: "http://localhost/bg-removal-data/",
		debug: true,
		proxyToWorker: true,
		fetchArgs: {
			mode: 'no-cors'
		},
		model: "medium",
		output: {
			format: "image/png",
			quality: 0.8,
			type: "foreground"
		}
	}).then((Blob) => {
		const url = URL.createObjectURL(blob);
		console.log("hi");
		console.log(url);
		onUpdateImage();
	});
};

export default removeImageBackground;