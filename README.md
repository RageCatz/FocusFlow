# FocusFlow

FocusFlow is a web-based study platform designed to help high school students manage tasks, stay focused, take structured breaks and track their study progress.

## Live Website

https://focusflow-two-sand.vercel.app/login.html

FocusFlow runs directly in a web browser, so no installation is required to use the online version.

## How to Run

### Online
1. Open the FocusFlow website using the link above.
2. Create an account or log in.
3. FocusFlow will run directly in your browser.

### From the Source Code
1. Download the FocusFlow project.
2. Open the `backend` folder in a terminal.
3. Install the required dependencies:

   npm install

4. Add the required environment variables using `.env.example`.
5. Start the backend:

   npm start

## Requirements

- Internet connection
- Modern web browser such as Chrome or Edge
- JavaScript enabled
- Camera permission is optional and only needed for Study Monitoring
- Speakers/headphones are optional for sounds and alarms
- Node.js and npm are required when running the backend locally

## Libraries

FocusFlow uses JavaScript and Node.js. The required backend libraries are listed in `package.json` and can be installed using:

npm install

## How to Use

1. Create an account or log in.
2. Add and organise schoolwork on the Tasks page.
3. Use the Focus page to select a task and start a Focus Session.
4. Optionally enable Study Monitoring for camera presence detection.
5. Use the Break page to take a timed break.
6. View study activity and goals on the Progress page.
7. Change preferences on the Settings page.

## FAQ

**Do I have to use my camera?**  
No. Study Monitoring is optional.

**Why can't I hear the sounds or alarm?**  
Check your device volume and browser audio permissions.

**Why isn't Study Monitoring working?**  
Check that camera permission has been allowed in your browser.

**What should I do if FocusFlow does not load?**  
Check your internet connection and refresh the page.