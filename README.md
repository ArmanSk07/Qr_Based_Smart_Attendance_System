Local Setup & Deployment Guide: QR Attendance System
This document outlines the step-by-step process for configuring and executing the QR Attendance System in a local development environment.

System Prerequisites
Ensure the following core technologies are installed on your machine before proceeding:

Node.js: Download & Install Node.js

Python: Download & Install Python

Phase 1: Backend Configuration (Django Database)
Open the root project directory in your code editor (e.g., VS Code).

Launch a new terminal instance and navigate to the backend directory.

Install the required Python dependencies.

Initialize the database schemas.

Create an administrative user for system access.

Boot the backend server on port 8080.

Execution Commands:

Bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8080
Important: Keep this terminal instance active. The backend server must remain running continuously to process API requests.

Phase 2: Frontend Configuration (React Interface)
Open a secondary terminal instance and ensure you are in the root project directory (run cd .. if you are still in the backend folder).

Install the necessary Node modules.

Create an environment variables file. Create a new file named .env in the root folder and add the following line: VITE_API_URL=[http://127.0.0.1:8080/api](http://127.0.0.1:8080/api)

Initialize the frontend development server.

Execution Commands:

Bash
npm install
npm run dev
Dependency Note: Running npm install automatically provisions all packages listed in your package.json. If you are setting up this project from scratch on a new machine without a package lock, you can manually install the core UI libraries using: npm install react-router-dom recharts react-qr-code lucide-react.

Phase 3: System Access
Launch your web browser and navigate to the local development URL displayed in your secondary terminal (typically http://localhost:5173).

Authenticate using the admin credentials established during Phase 1.

Troubleshooting & Common Issues
Network or Connection Errors: Verify that your primary terminal running the Python backend is still active and has not crashed.

Broken Images or Upload Failures: Confirm that the backend/media directory exists. If it does not, create the folder manually.

Mobile Scanning Failures: Ensure the host machine and the mobile scanner are connected to the exact same Wi-Fi network. You must also expose your frontend to the local network by starting it with the host flag: npm run dev -- --host.
