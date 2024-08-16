import cryto from "crypto";
import {google} from "googleapis";
import auth from "./googleCalendarCredentials.json" assert {type: "json"};
import express from "express";
import secrets from "./secrets.js";
import crypto from "crypto";
import {server} from "./server.js";

const router = express.Router();

const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_PRIVATE_KEY = auth.private_key;
const GOOGLE_CLIENT_EMAIL = auth.client_email;
const GOOGLE_PROJECT_NUMBER = auth.project_id;
const GOOGLE_CALENDAR_ID = "max.matthews@wearetuzag.com";

const jwtClient = new google.auth.JWT(
	GOOGLE_CLIENT_EMAIL,
	null,
	GOOGLE_PRIVATE_KEY,
	SCOPES,
);

const calendar = google.calendar({
	version: "v3",
	project: GOOGLE_PROJECT_NUMBER,
	auth: jwtClient,
});

router.post("/calendlyCancellation", async (req, res) => {
	try {
		const validate = calendlyValidation(req);

		if (!["invitee.canceled", "invitee_no_show.created"].includes(req.body.event)) {
			return res.send({message: "not a cancellation event type"})
		}

		if (validate) {
			const oneMonthOut = new Date();
			oneMonthOut.setMonth(oneMonthOut.getMonth() + 1);

			const googleResponse = await calendar.events.list({
				calendarId: GOOGLE_CALENDAR_ID,
				timeMin: new Date().toISOString(),
				timeMax: oneMonthOut.toISOString(),
				singleEvents: true,
				orderBy: "startTime",
				maxResults: 2499,
				q: "CiC"
			});

			const googleEvents = googleResponse.data.items;


			if (!googleEvents || googleEvents.length === 0 || googleEvents.length > 2498) {
				//google events didn't sync. we shouldn't try to create any new items
				console.error("Google events didn't sync. Exiting.");
				return res.send({});
			}

			const matchingEvent = googleEvents.find((googleEvent) => {
				if (!googleEvent.start.dateTime) {
					//filter out all day events
					return false;
				}
				return (
					new Date(googleEvent.start.dateTime).toISOString() ===
					new Date(req.body.payload.scheduled_event.start_time).toISOString()
				);
			});

			if (matchingEvent) {
				await calendar.events.delete({
					calendarId: GOOGLE_CALENDAR_ID,
					eventId: matchingEvent.id
				});
			}
			return res.send({});

		} else {
			console.error("invalid hook");
			return res.status(401).send({error: "invalid hook"})
		}
	} catch (err) {
		console.error(err)
		console.error("invalid hook");
		return res.status(401).send({error: "invalid hook"})
	}
})

const calendlyValidation = (req) => {
	const webhookSigningKey = secrets.calendlyWebhookSigningKey;

// Extract the timestamp and signature from the header
	const calendlySignature = req.get('Calendly-Webhook-Signature');
	const {t, signature} = calendlySignature.split(',').reduce((acc, currentValue) => {
		const [key, value] = currentValue.split('=');

		if (key === 't') {
			// UNIX timestamp
			acc.t = value;
		}

		if (key === 'v1') {
			acc.signature = value
		}

		return acc;
	}, {
		t: '',
		signature: ''
	});

	if (!t || !signature) {
		return false;
	}


// Create the signed payload by concatenating the timestamp (t), the character '.' and the request body's JSON payload.
	const data = t + '.' + JSON.stringify(req.body);

	const expectedSignature = crypto.createHmac('sha256', webhookSigningKey).update(data, 'utf8').digest('hex');

// Determine the expected signature by computing an HMAC with the SHA256 hash function.

	if (expectedSignature !== signature) {
		// Signature is invalid!
		throw new Error('Invalid Signature');
	}

	/*
	 * Prevent replay attacks
	 *
	 * If an attacker intercepts the webhook's payload and signature, they could
	 * potentially re-transmit the request. This is known as a replay attack. This
	 * type of attack can be mitigated by utilizing the timestamp in the
	 * Calendly-Webhook-Signature header. In the example below, we set the
	 * application's tolerance zone to 3 minutes. This helps mitigate replay attacks
	 * by ensuring that requests that have timestamps that are more than 3 minutes old will
	 * not be considered valid.
	*/

	const threeMinutes = 180000;
	const tolerance = threeMinutes;
	const timestampMilliseconds = Number(t) * 1000;

	if (timestampMilliseconds < Date.now() - tolerance) {
		// Signature is invalid!
		// The signature's timestamp is outside of the tolerance zone defined above.
		return false;
		// throw new Error("Invalid Signature. The signature's timestamp is outside of the tolerance zone.");
	}

	return true;
}


export default router;
