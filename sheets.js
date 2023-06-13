import { google } from "googleapis";

import auth from "./googleCredentials.json" assert { type: "json" };

const updateSpreadsheet = async (youtubeURL) => {
	const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
	const GOOGLE_PRIVATE_KEY = auth.private_key;
	const GOOGLE_CLIENT_EMAIL = auth.client_email;
	const GOOGLE_PROJECT_NUMBER = auth.project_id;
	const spreadsheetId = "1BcwCF0oMbNZ8mxlB9j8E0me8LRn5M0Fi-X-CcxwxksQ";

	const jwtClient = new google.auth.JWT(
		GOOGLE_CLIENT_EMAIL,
		null,
		GOOGLE_PRIVATE_KEY,
		SCOPES
	);

	const alphabet = [
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
		"T",
		"U",
		"V",
		"W",
		"X",
		"Y",
		"Z",
	];

	const service = google.sheets({
		version: "v4",
		auth: jwtClient,
		// project: GOOGLE_PROJECT_NUMBER,
	});

	const res = await service.spreadsheets.values.get({
		spreadsheetId,
		range: "A1:Z39",
	});

	const values = res.data.values;

	let dayCode;

	for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
		for (let colIndex = 0; colIndex < values[rowIndex].length; colIndex++) {
			const cellValue = values[rowIndex][colIndex];
			if (cellValue === new Date().toLocaleDateString()) {
				dayCode = values[rowIndex-1][colIndex];
				const colLetter = alphabet[colIndex];
				const videoCellRowNum = rowIndex + 5;
				const cellRange = `${colLetter}${videoCellRowNum}`;

				await service.spreadsheets.values.update({
					spreadsheetId,
					range: cellRange,
					valueInputOption: "USER_ENTERED",
					resource: { values: [[`=HYPERLINK("${youtubeURL}", "Video")`]] },
				});
			}
		}
	}
	return dayCode;
};

export default updateSpreadsheet;
