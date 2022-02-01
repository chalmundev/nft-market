module.exports = {
	apps : [
		{
		  name: "default",
		  script: "./index.js",
		  watch: true,
		  env: {
			  "NODE_ENV": "dev"
		  },
		  env_prod: {
			  "NODE_ENV": "prod",
		  }
		}
	]
  }