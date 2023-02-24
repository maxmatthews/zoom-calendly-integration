module.exports = {
	apps: [
		{
			name: "zoom-youtube-calendly",
			script: "./server.js",

			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: "1G",
			max_restarts: 10,
			restart_delay: 1000,
			// env: {
			// 	COMPILED: true,
			// 	PORT: 80,
			// },
		},
	],
};
