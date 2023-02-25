import express from "express";
import bodyParser from "body-parser";
import * as crypto from "crypto";
import secrets from "./secrets.js";
import { subMinutes, addMinutes } from "date-fns";
import sgMail from "@sendgrid/mail";
import { generateHTML, generatePlainText } from "./emailContent.js";
import { downloadFile, deleteFile } from "./download.js";
import uploadFileToYouTube from "./puppeteer.js";

//express server and sendgrid API setup
export const server = express();
server.use(bodyParser.json());
sgMail.setApiKey(secrets.sendgridAPIKey);

server.post("/zoomWebhookHU", async (req, res) => {
	if (req.body.event === "endpoint.url_validation") {
		zoomURLValidation(req, res, secrets.zoomSecret2);
	} else {
		if (zoomWebhookValidation(req, secrets.zoomSecret2)) {
			console.log("auth failure");
			return res.status(401).send({ success: false, message: "auth failure" });
		}

		//send something back to Zoom while we download the file so it isn't marked as a failure
		res.send({ webhook: true });

		if (
			req.body.payload.object.topic === "CiC C4 Classroom" &&
			req.body.payload.object.duration > 91
		) {
			try {
				const filePath = await downloadFile(req.body);
				await uploadFileToYouTube(filePath);
				deleteFile(filePath);
			} catch (error) {
				console.error(error);
				sendFailureMessage(req);
			}
		}
	}
});

server.post("/zoomWebhook", async (req, res) => {
	if (req.body.event === "endpoint.url_validation") {
		zoomURLValidation(req, res, secrets.zoomSecret);
	} else {
		if (zoomWebhookValidation(req, secrets.zoomSecret)) {
			console.log("auth failure");
			return res.status(401).send({ success: false, message: "auth failure" });
		}

		if (req.body.payload.object.duration < 8) {
			return res.send("recording is too short, thanks though!");
		}

		const calendlyEvents = await getScheduledEventsFromCalendly(req);

		//match the zoom webhook data with the calendly events by using the zoom
		//meeting ID which Calendly also stores
		const matchingEvent = calendlyEvents.collection.find(
			(event) => event.location.data.id === req.body.payload.object.id
		);

		if (!matchingEvent) {
			return await sendFailureMessage(req);
		} else {
			res.send({ success: true });
			const inviteeEmails = await getInvitees(matchingEvent);

			return await sendEmails(inviteeEmails, req);
		}
	}
});

//Zoom initiated request to this endpoint to validate our server has the correct secret
const zoomURLValidation = (req, res, zoomSecret) => {
	//this code is taken right from an example in the Zoom documentation to hash
	//together our secret with the token in the body
	const hashForValidate = crypto
		.createHmac("sha256", zoomSecret)
		.update(req.body.payload.plainToken)
		.digest("hex");

	res.status(200);
	res.send({
		plainToken: req.body.payload.plainToken,
		encryptedToken: hashForValidate,
	});
};

//used to verify webhook calls are actually coming from zoom
const zoomWebhookValidation = (req, zoomSecret) => {
	const message = `v0:${req.headers["x-zm-request-timestamp"]}:${JSON.stringify(
		req.body
	)}`;

	//crypto scares me, but the Zoom example code is very helpful
	const hashForVerify = crypto
		.createHmac("sha256", zoomSecret)
		.update(message)
		.digest("hex");

	const signature = `v0=${hashForVerify}`;

	return !!req.headers["x-zm-signature"] === signature;
};

//use rough date math to find calendly events that were scheduled around the start time of the meeting
const getScheduledEventsFromCalendly = async (req) => {
	const minFromStart = subMinutes(
		new Date(req.body.payload.object.start_time),
		90
	).toISOString();
	const maxFromNow = addMinutes(new Date(), 90).toISOString();

	//find all the events for my "orginization" that started within 90 minutes of the zoom time
	//but are not scheduled for more than 90 minutes from the current time
	const calendlyResponse = await fetch(
		`https://api.calendly.com/scheduled_events?organization=${secrets.calendlyOrg}&min_start_time=${minFromStart}&max_start_time=${maxFromNow}&sort=start_time:asc`,
		{
			headers: {
				Authorization: `Bearer ${secrets.calendlyPAT}`,
			},
		}
	);

	return await calendlyResponse.json();
};

const sendFailureMessage = async (req) => {
	const msg = {
		to: "max@zane.tech",
		from: "max@zane.tech",
		subject: `Warning: Recording Not Sent ${new Date().toLocaleDateString()}`,
		html: `Recording not sent for ${req.body.payload.object?.topic} (${
			req.body.payload.object?.id
		})<br/>Started: ${new Date(
			req.body.payload.object?.start_time
		).toLocaleString()}`.replaceAll(/\\n/g, "<br/>"),
	};

	await sgMail.send(msg);
};

const getInvitees = async (matchingEvent) => {
	const inviteesResponse = await fetch(`${matchingEvent.uri}/invitees`, {
		headers: {
			Authorization: `Bearer ${secrets.calendlyPAT}`,
		},
	});
	const inviteesData = await inviteesResponse.json();

	//filter out no-show invitees and then map th
	return inviteesData.collection
		.filter((invitee) => !invitee?.no_show?.created_at)
		.map((invitee) => invitee.email);
};

const sendEmails = async (inviteeEmails, req) => {
	for (const email of inviteeEmails) {
		const msg = {
			to: email,
			from: "max@zane.tech",
			subject: `Recording From Our Meeting ${new Date().toLocaleDateString()}`,
			text: generatePlainText(req),
			html: generateHTML(req),
		};

		try {
			await sgMail.send(msg);
		} catch (error) {
			console.error(error);

			if (error.response) {
				console.error(error.response.body);
			}
			return;
		}
	}
};

server.get("/", (req, res) => {
	res.send({ server: "running" });
});

server.listen(3000, "0.0.0.0", () => {
	console.log("Server running");
});
