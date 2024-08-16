import OpenAI from "openai";
import secrets from "./secrets.js";
import {temporaryFile, temporaryDirectory} from "tempy";
import fs from "fs";
import {finished} from "stream/promises";
import {Readable} from "stream";
import {deleteFile} from "./download.js";
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";
import auth from "./googleCredentials.json" assert {type: "json"};
import {google} from "googleapis";

const SCOPES = "https://www.googleapis.com/auth/drive";
const GOOGLE_PRIVATE_KEY = auth.private_key;
const GOOGLE_CLIENT_EMAIL = auth.client_email;
const GOOGLE_PROJECT_NUMBER = auth.project_id;

const jwtClient = new google.auth.JWT(
	GOOGLE_CLIENT_EMAIL,
	null,
	GOOGLE_PRIVATE_KEY,
	SCOPES,
);

const service = google.drive({
	version: "v3",
	auth: jwtClient,
	// project: GOOGLE_PROJECT_NUMBER,
});

const openai = new OpenAI({apiKey: secrets.openAPIKey});

const generateThumbnail = async (prompt, dayCode, localRun = false) => {
	if (!prompt) {
		prompt = `Careers in Code bootcamp Date: ${
			dayCode || new Date().toLocaleDateString()
		}`;
	}

	prompt = prompt.replace(/P\d/g, "");

	try {
		const tempFilePath = temporaryFile({extension: "png"});

		//generate the thumbnail, this can take a while
		const response = await openai.images.generate({
			model: "dall-e-3",
			prompt,
			n: 1,
			size: "1792x1024",
		});

		//download the image
		const imageURL = response.data[0].url;
		const stream = fs.createWriteStream(tempFilePath);
		const {body} = await fetch(imageURL);
		await finished(Readable.fromWeb(body).pipe(stream));

		//upload it to Google drive
		const requestBody = {
			name: `${dayCode} - ${prompt}.png`,
			fields: "id",
			parents: ["1rBl5eWjMwCEBq7Nr6gpVH1rNUbC5t1eL"],
		};
		const media = {
			mimeType: "image/png",
			body: fs.createReadStream(tempFilePath),
		};
		try {
			const file = await service.files.create({
				requestBody,
				media,
			});
			console.log("File Id:", file.data.id);
			// return file.data.id;
		} catch (err) {
			console.error(err);
			// throw err;
		}

		//compress the image for youtube
		const compressedDest = localRun
			? "/Users/maxmatthews/Downloads"
			: temporaryDirectory();
		const files = await imagemin([tempFilePath], {
			destination: compressedDest,
			plugins: [
				imageminPngquant({
					quality: [0.6, 0.8],
				}),
			],
		});
		const compressedPath = files[0].destinationPath;

		deleteFile(tempFilePath);
		deleteFile(compressedPath);

		return compressedPath;
	} catch (e) {
		console.error(e);
	}
};

// await generateThumbnail("React Weather P2", "W14D2", true);
// process.exit();
export default generateThumbnail;
