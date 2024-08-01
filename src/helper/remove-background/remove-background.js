import { getRaster } from '../layer';

const removeImageBackground = async function (onUpdateImage) {
	await loadExternalScript('http://localhost/bg-removal-data/onnxruntime-web/ort.all.min.js');
	const ort = window.ort;
	console.log(ort);
	const { default: imglyRemoveBackground } = await import("@imgly/background-removal");
	
	const inBlob = getRaster().source;
	
	imglyRemoveBackground(inBlob, {
		publicPath: "http://localhost/bg-removal-data/imgly/",
		debug: false,
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

async function loadExternalScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.type = 'text/javascript';
		script.async = true;

		// Resolve the promise when the script is loaded
		script.onload = () => {
			console.log(`${src} has been loaded`);
			resolve();
		};

		// Reject the promise if there's an error loading the script
		script.onerror = () => {
			reject(new Error(`Failed to load script ${src}`));
		};

		// Append the script to the document head
		document.head.appendChild(script);
	});
}

export default removeImageBackground;