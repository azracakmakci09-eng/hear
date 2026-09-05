# HEAR — GitHub + Render

## GitHub
Create a new GitHub repository and upload the **contents of this folder** (not the outer folder itself).

## Render
1. Create a Render Web Service.
2. Connect the GitHub repository.
3. Render will use:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Deploy.
5. Open the `onrender.com` URL in Chrome.

No Node.js or terminal is needed on your own computer once the repository is on GitHub and deployed to Render.

## Important
The service must be a **Web Service**, not a Static Site, because multiplayer needs the Node server.
