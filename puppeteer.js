import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { executablePath } from "puppeteer";
import * as OTPAuth from "otpauth";
import secrets from "./secrets.js";
import updateSpreadsheet from "./sheets.js";
import generateThumbnail from "./thumbnail.js";

const wait = async (time) => {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
};
const uploadFileToYouTube = async (filePath) => {
	puppeteer.use(StealthPlugin());

	const browser = await puppeteer.launch({
		args: ["--windowsize=1920,1080", "--no-sandbox"],
		headless: false, //google auth doesn't work if headless is set to true, it fails on the password reset
		executablePath:
			process.platform === "darwin"
				? executablePath()
				: "/usr/bin/chromium-browser",
	});

	const context = browser.defaultBrowserContext();
	context.overridePermissions("https://www.youtube.com", ["notifications"]);

	const page = await browser.newPage();

	const navigationPromise = page.waitForNavigation();
	await page.goto("https://youtube.com/");

	await navigationPromise;
	await page.waitForSelector('a[aria-label="Sign in"]');
	await page.click('a[aria-label="Sign in"]');
	await page.type('input[type="email"]', secrets.gmailEmail);
	await page.waitForSelector("#identifierNext");
	await page.click("#identifierNext");

	await wait(10000);
	await page.waitForSelector('input[type="password"]');
	// await page.click('input[type="email"]');
	// await wait(5000);
	await page.type('input[type="password"]', secrets.gmailPassword);
	await page.waitForSelector("#passwordNext");
	await page.click("#passwordNext");

	await wait(5000);

	try {
		const tryAnotherWayBypass = await page.$('div[data-challengetype="6"]');
		if (!tryAnotherWayBypass) {
			await page.waitForXPath(`//span[contains(text(), 'Try another way')]`);
			const tryAnotherWay = await page.$x(
				`//span[contains(text(), 'Try another way')]`,
			);
			await tryAnotherWay[0].click();

			await wait(5000);
		}

		await page.waitForSelector('div[data-challengetype="6"]');
		await page.click('div[data-challengetype="6"]');

		await wait(2000);
		await page.waitForSelector(`#totpPin`);
		await page.type(`#totpPin`, generateOTP());
		await page.click("#totpNext");
	} catch (err) {
		console.error(err);
		//might not have to 2FA, so see if we can just ignore the error and keep going
	}

	await wait(10000);
	await page.waitForXPath(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`,
	);
	await wait(1000);
	const huChannel = await page.$x(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`,
	);
	await huChannel[0].click();
	await wait(1000);

	await page.waitForSelector("button[aria-label='Create']");
	await page.click("button[aria-label='Create']");

	await page.waitForSelector("a[href='/upload']");
	await page.click("a[href='/upload']");

	await navigationPromise;

	await page.waitForXPath(`//div[contains(text(), 'Select files')]`);
	const selectFiles = await page.$x(`//div[contains(text(), 'Select files')]`);
	const [fileChooser] = await Promise.all([
		page.waitForFileChooser(),
		await selectFiles[0].click(),
	]);
	await fileChooser.accept([filePath]);

	await page.waitForXPath(
		'//tp-yt-paper-progress[contains(@class,"ytcp-video-upload-progress-hover") and @value="100"]',
		{ timeout: 0 },
	);
	await wait(5000);

	await page.waitForSelector(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`,
	);
	const titleInput = await page.$(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`,
	);

	await wait(20000);
	//this doesn't work, should probably wait until the link is generated instead of just waiting an arbitrary time
	// await page.waitForXPath(
	// 	`a[contains(text(), "https://")]`,
	// 	// '//tp-yt-paper-progress[contains(@class,"ytcp-video-upload-progress-hover") and @value="100"]',
	// 	{ timeout: 0 }
	// );
	await page.waitForSelector(`a[class="style-scope ytcp-video-info"]`);
	const urlElement = await page.$(`a[class="style-scope ytcp-video-info"]`);

	//not required for advent of code
	const videoURL = await (await urlElement.getProperty("href")).jsonValue();
	const { dayCode, topic } = await updateSpreadsheet(videoURL);

	//generate thumbnail and upload it to YouTube
	const thumbnailPath = await generateThumbnail(topic, dayCode);
	if (thumbnailPath) {
		await page.waitForXPath(`//span[contains(text(), 'Upload thumbnail')]`);
		const selectThumbnailFile = await page.$x(
			`//span[contains(text(), 'Upload thumbnail')]`,
		);
		const [fileThumbnailChooser] = await Promise.all([
			page.waitForFileChooser(),
			await selectThumbnailFile[0].click(),
		]);
		await fileThumbnailChooser.accept([thumbnailPath]);
	}

	//click on title and input text
	await titleInput.click({ clickCount: 3 });
	//disabled for advent of code
	await page.type(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`,
		dayCode
			? `C6 ${dayCode}${topic ? `: ${topic}` : ""}`
			: new Date().toLocaleDateString(),
	);

	//enable this for advent of code
	// await page.type(
	// 	`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`,
	// 	`Advent of Code 2023 #${new Date().getDate()}`,
	// );

	await page.click(".ytcp-video-metadata-playlists");
	await wait(5000);
	const playlist = await page.$x(
		`//span[contains(text(), 'Careers in Code C6')]`,
	); //CiC C5
	await playlist[0].click();
	await page.click("#next-button");

	await wait(500);
	await page.click("#next-button");

	await wait(500);
	await page.click("#next-button");

	await wait(500);
	await page.click("#next-button");

	await wait(1500);
	await page.waitForSelector(`#done-button`);
	await page.click("#done-button");
	await wait(5000);

	await browser.close();
};

const generateOTP = () => {
	let parsedTotp = OTPAuth.URI.parse(secrets.otp);
	let totp = new OTPAuth.TOTP(parsedTotp);
	return totp.generate();
};

export default uploadFileToYouTube;
