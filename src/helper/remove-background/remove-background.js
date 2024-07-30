import "regenerator-runtime/runtime";
import './vendor/imgly-background-removal.js';
import { getRaster } from '../layer';

const removeImageBackground = async function (onUpdateImage) {
	const inBlob = getRaster().source;
	console.log(inBlob);
	await window.imglyRemoveBackground(inBlob, {
		publicPath: "https://staticimgly.com/@imgly/background-removal-data/@1.4.1/dist/",
		debug: true,
		proxyToWorker: false,
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