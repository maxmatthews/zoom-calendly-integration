import express from "express";
import bodyParser from "body-parser";
import * as crypto from "crypto";
import secrets from "./secrets.js";
import fetch from "node-fetch";
import { subMinutes, addMinutes } from "date-fns";
import sgMail from "@sendgrid/mail";

export const server = express();
server.use(bodyParser.json());
sgMail.setApiKey(secrets.sendgridAPIKey);

server.post("/zoomWebhook", async (req, res) => {
	if (req.body.event === "endpoint.url_validation") {
		const hashForValidate = crypto
			.createHmac("sha256", secrets.zoomSecret)
			.update(req.body.payload.plainToken)
			.digest("hex");

		res.status(200);
		res.send({
			plainToken: req.body.payload.plainToken,
			encryptedToken: hashForValidate,
		});
	} else {
		const message = `v0:${
			req.headers["x-zm-request-timestamp"]
		}:${JSON.stringify(req.body)}`;

		const hashForVerify = crypto
			.createHmac("sha256", secrets.zoomSecret)
			.update(message)
			.digest("hex");

		const signature = `v0=${hashForVerify}`;

		if (req.headers["x-zm-signature"] === signature) {
			const calendlyResponse = await fetch(
				`https://api.calendly.com/scheduled_events?organization=${
					secrets.calendlyOrg
				}&min_start_time=${subMinutes(
					new Date(req.body.payload.object.start_time),
					90
				).toISOString()}&max_start_time=${addMinutes(
					new Date(),
					90
				).toISOString()}&sort=start_time:asc`,
				{
					headers: {
						Authorization: `Bearer ${secrets.calendlyPAT}`,
					},
				}
			);

			const data = await calendlyResponse.json();
			const matchingEvent = data.collection.find(
				(event) => event.location.data.id === req.body.payload.object.id
			);

			if (!matchingEvent) {
				const msg = {
					to: "max@zane.tech",
					from: "max@zane.tech", // Use the email address or domain you verified above
					subject: `Warning: Recording Not Sent ${new Date().toLocaleDateString()}`,
					html: `Recording not sent for ${req.body.payload.object?.topic} (${
						req.body.payload.object?.id
					})<br/>Started: ${new Date(
						req.body.payload.object?.start_time
					).toLocaleString()}`.replaceAll(/\\n/g, "<br/>"),
				};

				await sgMail.send(msg);
				res.send({ success: false });
			} else {
				const inviteesResponse = await fetch(`${matchingEvent.uri}/invitees`, {
					headers: {
						Authorization: `Bearer ${secrets.calendlyPAT}`,
					},
				});
				const inviteesData = await inviteesResponse.json();

				let inviteeEmails = inviteesData.collection
					.filter((invitee) => !invitee?.no_show?.created_at)
					.map((invitee) => invitee.email);

				for (const email of inviteeEmails) {
					const msg = {
						to: email,
						from: "max@zane.tech",
						subject: `Recording From Our Meeting ${new Date().toLocaleDateString()}`,
						text: `Hi! I'm MaxBot!

Just dropping the link to the recording with my human counterpart here: ${req.body.payload.object.share_url}

The password is: ${req.body.payload.object.password}

Please download the view or download the file within 7 days.

Thanks,
Max(Bot) Matthews`,

						html: `Hi! I'm MaxBot!<br/>
<br/>
Just dropping the link to the recording with my human counterpart here: <a href="${req.body.payload.object.share_url}">${req.body.payload.object.share_url}</a><br/>
<br/>
The password is: <span style="font-family: Courier, 'Courier New', monospace; color: #E74C3C;">${req.body.payload.object.password}</span><br/>
<br/>
Please download the view or download the file within 7 days.<br/>
<br/>
Thanks,<br/>
Max(Bot)<br/>
<img src="https://d3v0px0pttie1i.cloudfront.net/uploads/user/logo/2915883/99e44e90.png"/>`.replaceAll(
							/\\n/g,
							"<br/>"
						),
					};

					try {
						await sgMail.send(msg);
					} catch (error) {
						console.error(error);

						if (error.response) {
							console.error(error.response.body);
						}
						res.send({ success: false });
						return;
					}
				}
				res.send({ success: true });
			}
		} else {
			console.log("auth failure");
			res.send({ success: false, message: "auth failure" });
		}
	}
});

server.get("/", (req, res) => {
	res.send({ server: "running" });
});

server.listen(3000);
