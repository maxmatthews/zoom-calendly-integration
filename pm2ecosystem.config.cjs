module.exports = {
	apps: [
		//Xvfb is required to get headless mode to be set to false on Linux
		{name: "Xvfb", script: "Xvfb", args: ":99"},
		{
			name: "zoom-youtube-calendly",
			script: "./server.js",
			interpreter: "/home/odroid/.nvm/versions/node/v22.13.1/bin/node",
			
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: "1G",
			max_restarts: 10,
			restart_delay: 1000,
			env: {
				DISPLAY: ":99",
				// 	COMPILED: true,
				// 	PORT: 80,
			},
		},
	],
};
