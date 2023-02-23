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

(async () => {
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
	//
	// await page.waitForXPath(`//span[contains(text(), 'Try another way')]`);
	// const tryAnotherWay = await page.$x(
	// 	`//span[contains(text(), 'Try another way')]`
	// );
	// await tryAnotherWay[0].click();

	await page.waitForSelector('div[data-challengetype="6"]');
	await page.click('div[data-challengetype="6"]');

	await wait(5000);
	await page.waitForSelector(`#totpPin`);
	await page.type(`#totpPin`, generateOTP());
	await page.click("#totpNext");

	await wait(5000);
	await page.waitForXPath(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`
	);
	const huChannel = await page.$x(
		`//yt-formatted-string[contains(text(), 'Hack Upstate')]`
	);
	await huChannel[0].click();
	await wait(5000);

	await page.click("button[aria-label='Create']");
	await page.click("a[href='/upload']");

	await navigationPromise;

	await page.waitForXPath(`//div[contains(text(), 'Select files')]`);
	const selectFiles = await page.$x(`//div[contains(text(), 'Select files')]`);
	const [fileChooser] = await Promise.all([
		page.waitForFileChooser(),
		await selectFiles[0].click(),
		// some button that triggers file selection
	]);
	await fileChooser.accept([
		"/Users/maxmatthews/Downloads/GMT20230222-222545_Recording_2560x1440.mp4",
	]);

	// await browser.close();
})();

const generateOTP = () => {
	let parsedTotp = OTPAuth.URI.parse(secrets.otp);
	let totp = new OTPAuth.TOTP(parsedTotp);
	return totp.generate();
};
