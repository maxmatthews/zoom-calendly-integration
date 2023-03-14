import fs from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { temporaryFile } from "tempy";
// import zoomBody from "./zoomWebhookPayloadExample.js";

const downloadFile = async (zoomBody) => {
	const tempFilePath = temporaryFile({ extension: "mp4" });

	let largestFileSize = 0;
	let largestFile;

	for (const file of zoomBody.payload.object.recording_files) {
		if (file.file_size > largestFileSize) {
			largestFile = file;
			largestFileSize = file.file_size;
		}
	}

	const stream = fs.createWriteStream(tempFilePath);
	const { body } = await fetch(
		`${largestFile.download_url}?access_token=${zoomBody.download_token}`
	);
	await finished(Readable.fromWeb(body).pipe(stream));

	return tempFilePath;
};

const deleteFile = (tempFilePath) => {
	setTimeout(() => {
		fs.unlinkSync(tempFilePath);
	}, 60000 * 5);
};

export { downloadFile, deleteFile };
