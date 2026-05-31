--- FRONTEND INSTALLATION COMMAND ---

To install all required libraries for this React project on a new computer, 
open a terminal in the main project folder and run:

npm install react-router-dom recharts react-qr-code lucide-react

(Note: Running 'npm install' by itself will also automatically read the 
package.json file and install everything needed.)


===============================================================
   QR ATTENDANCE SYSTEM - SETUP & RUN GUIDE
===============================================================

PREREQUISITES:
1. Install Node.js (https://nodejs.org/)
2. Install Python (https://www.python.org/)

---------------------------------------------------------------
STEP 1: SETUP BACKEND (DATABASE)
---------------------------------------------------------------
1. Open the project folder in VS Code.
2. Open a Terminal.
3. Navigate to the backend folder:
   cd backend

4. Install the Python dependencies:
   pip install -r requirements.txt

5. Initialize the Database:
   python manage.py migrate

6. Create an Admin User (to login):
   python manage.py createsuperuser
   (Enter Username: admin, Password: 1234)

7. Start the Backend Server:
   python manage.py runserver 8080

   > Keep this terminal OPEN. It must stay running.

---------------------------------------------------------------
STEP 2: SETUP FRONTEND (WEBSITE)
---------------------------------------------------------------
1. Open a SECOND Terminal (Do not close the first one).
2. Navigate to the main project folder (if you are in backend, type: cd ..)

3. Install Node Modules:
   npm install

4. Create the Environment File:
   - Create a new file named ".env" in the main folder.
   - Paste this line inside it:
     VITE_API_URL=http://127.0.0.1:8080/api

5. Start the Website:
   npm run dev

---------------------------------------------------------------
STEP 3: LOGIN
---------------------------------------------------------------
1. Open your browser and go to the link shown in Terminal 2 
   (Usually: http://localhost:5173)

2. Login with the credentials you created in Step 1.
   (Default: admin / 1234)

---------------------------------------------------------------
TROUBLESHOOTING
---------------------------------------------------------------
- If you see "Network Error": Check if Terminal 1 (Python) is running.
- If images don't load: Ensure the 'backend/media' folder exists.
- If mobile scanning fails: Ensure both devices are on the same WiFi 
  and run the frontend with: npm run dev -- --host