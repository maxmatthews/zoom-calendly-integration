import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { executablePath } from "puppeteer";
import * as OTPAuth from "otpauth";
import secrets from "./secrets.js";

const wait = async (time) => {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
};

const uploadFileToYouTube = async (filePath) => {
	puppeteer.use(StealthPlugin());

	const browser = await puppeteer.launch({
		headless: false,
		executablePath: executablePath(),
	});
	const page = await browser.newPage();
	const navigationPromise = page.waitForNavigation();
	await page.goto("https://youtube.com/");
	await navigationPromise;
	await page.waitForSelector('a[aria-label="Sign in"]');
	await page.click('a[aria-label="Sign in"]');
	await page.type('input[type="email"]', secrets.gmailEmail);
	await page.waitForSelector("#identifierNext");
	await page.click("#identifierNext");

	await wait(5000);

	await page.waitForSelector('input[type="password"]');
	await page.click('input[type="email"]');
	await wait(5000);
	await page.type('input[type="password"]', secrets.gmailPassword);

	await page.waitForSelector("#passwordNext");
	await page.click("#passwordNext");
	await navigationPromise;

	await wait(5000);

	const tryAnotherWayBypass = await page.$('div[data-challengetype="6"]');
	if (!tryAnotherWayBypass) {
		await page.waitForXPath(`//span[contains(text(), 'Try another way')]`);
		const tryAnotherWay = await page.$x(
			`//span[contains(text(), 'Try another way')]`
		);
		await tryAnotherWay[0].click();

		await wait(1000);
	}

	await page.waitForSelector('div[data-challengetype="6"]');
	await page.click('div[data-challengetype="6"]');

	await wait(2000);
	await page.waitForSelector(`#totpPin`);
	await page.type(`#totpPin`, generateOTP());
	await page.click("#totpNext");

	await wait(1000);
	await page.waitForXPath(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`
	);
	const huChannel = await page.$x(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`
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

	await wait(10000);

	await page.waitForSelector(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`
	);
	const titleInput = await page.$(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`
	);
	await titleInput.click({ clickCount: 3 });
	await page.type(
		`div[aria-label="Add a title that describes your video (type @ to mention a channel)"]`,
		new Date().toLocaleDateString()
	);

	await page.click(".ytcp-video-metadata-playlists");
	await wait(5000);
	const playlist = await page.$x(`//span[contains(text(), 'CiC C4')]`);
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

	await browser.close();
};

const generateOTP = () => {
	let parsedTotp = OTPAuth.URI.parse(secrets.otp);
	let totp = new OTPAuth.TOTP(parsedTotp);
	return totp.generate();
};

export default uploadFileToYouTube;
