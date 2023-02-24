import fs from "fs";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { temporaryFile } from "tempy";
// import zoomBody from "./zoomWebhookPayloadExample.js";

const downloadFile = async (zoomBody)=> {
	const tempFilePath = temporaryFile({extension: "mp4"});

	const matchingFile = zoomBody.payload.object.recording_files.find(file => (file.file_extension === "MP4"));

	const stream = fs.createWriteStream(tempFilePath);
	const {body} = await fetch(`${matchingFile.download_url}?access_token=${zoomBody.download_token}`);
	await finished(Readable.fromWeb(body).pipe(stream));

	return tempFilePath;
}

const deleteFile = (tempFilePath)=>{
	setTimeout(() => {
		fs.unlinkSync(tempFilePath);
	}, 60000*5);

}


export  {downloadFile, deleteFile};