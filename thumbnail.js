import OpenAI from "openai";
import secrets from "./secrets.js";
import { temporaryFile, temporaryDirectory } from "tempy";
import fs from "fs";
import { finished } from "stream/promises";
import { Readable } from "stream";
import { deleteFile } from "./download.js";
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";

const openai = new OpenAI({ apiKey: secrets.openAPIKey });

const generateThumbnail = async (prompt, dayCode) => {
	if (!prompt) {
		prompt = `Careers in Code bootcamp Date: ${
			dayCode || new Date().toLocaleDateString()
		}`;
	}

	prompt = prompt.replace(/P\d/g, "");

	try {
		const tempFilePath = temporaryFile({ extension: "png" });

		const response = await openai.images.generate({
			model: "dall-e-3",
			prompt: `coding - ${prompt}`,
			n: 1,
			size: "1792x1024",
		});
		const imageURL = response.data[0].url;

		const stream = fs.createWriteStream(tempFilePath);
		const { body } = await fetch(imageURL);
		await finished(Readable.fromWeb(body).pipe(stream));

		const compressedDest = temporaryDirectory();
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

export default generateThumbnail;
