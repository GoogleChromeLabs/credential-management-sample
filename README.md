# Credential Management API Sample

- Try [a live demo](https://credential-management-sample.appspot.com).
- Learn [how Credential Management API works](TBD).

## Installation

### Prerequisites
- Google App Engine
- Python 2.7
- pip
- Node.js
- NPM
- Bower

### Step 1. Configure Google Sign-In
- Set up a new project at [Google Developers Console](https://console.developers.google.com/)
- Create credentials
- Download `client_secret_****.json`, rename it to `client_secrets.json`
- Place `client_secrets.json` at root of this project

![](static/images/howto/gsi_config.png)

### Step 2. Configure Facebook Login
- Set up a new project at [Facebook Developers](https://developers.facebook.com/)
- Set "Site URL" `http://localhost:8080`
- Copy and paste the App ID at line 18 of `static/scripts/app.js`.

![](static/images/howto/fb_config.png)

### Step 3. Install dependencies
- After cloning this repository, do the following:

```sh
# Clone submodules
$ git submodule init
$ git submodule update
# This command will install dependencies
$ npm install
```

### Step 4. Run the app
```sh
# Launch App Engine at root dir of this project with following command
$ dev_appserver.py .
```
