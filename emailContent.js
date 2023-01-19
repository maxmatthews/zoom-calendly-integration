const generatePlainText = (req) => {
	return `Hi! I'm MaxBot!

	Just dropping the link to the recording with my human counterpart here: ${req.body.payload.object.share_url}
	
	The password is: ${req.body.payload.object.password}
	
	Please download the view or download the file within 7 days.
	
	Thanks,
	Max(Bot) Matthews`;
};

const generateHTML = (req) => {
	return `Hi! I'm MaxBot!<br/>
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
	);
};

export { generatePlainText, generateHTML };
