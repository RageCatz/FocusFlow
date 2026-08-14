# FocusFlow

FocusFlow is a web-based study platform designed to help high school students manage tasks, stay focused, take structured breaks and track their study progress.

## Live Website

https://focusflow-two-sand.vercel.app/login.html

FocusFlow runs directly in a web browser, so no installation is required to use the online version.

**Please note:** When opening FocusFlow for the first time, the backend server may take approximately **30 seconds to start**. Before logging in or creating an account, please wait for the backend to become active. After the server has started, login and signup should work normally.

## How to Run

### Online

1. Open the FocusFlow website using the link above.
2. If this is your first time opening the website, wait approximately **30 seconds for the backend server to start**.
3. Create an account or log in.
4. FocusFlow will run directly in your browser.

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

1. Open FocusFlow and allow approximately **30 seconds for the backend server to start if necessary**.
2. Create an account or log in.
3. Add and organise schoolwork on the Tasks page.
4. Use the Focus page to select a task and start a Focus Session.
5. Optionally enable Study Monitoring for camera presence detection.
6. Use the Break page to take a timed break.
7. View study activity and goals on the Progress page.
8. Change preferences on the Settings page.

## FAQ

**Why does login or signup sometimes take a while when I first open FocusFlow?**  
The backend server may need approximately **30 seconds to start after a period of inactivity**. Wait for the server to become active, then try logging in or signing up again.

**Do I have to use my camera?**  
No. Study Monitoring is optional.

**Why can't I hear the sounds or alarm?**  
Check your device volume and browser audio permissions.

**Why isn't Study Monitoring working?**  
Check that camera permission has been allowed in your browser.

**What should I do if FocusFlow does not load?**  
Check your internet connection, wait approximately 30 seconds for the backend server if necessary, and refresh the page.