# Check-In/Check-Out System

A simple check-in/check-out system built with Express.js, MongoDB, and various middleware for security and validation.

## Features

- Check-In and Check-Out functionality
- Log viewing and filtering
- CSV export of logs
- Basic authentication for log download

## Requirements

- Node.js (v14 or higher)
- MongoDB
- Git (optional, for cloning the repository)

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/check-in-check-out-system.git
cd check-in-check-out-system
```

### 2. Install Dependencies
Make sure you are in the project directory and install the required Node.js packages:
```bash
npm install
```

### 3. Configure Environment Variables
Create a .env file in the root of the project with the following contents:
```
MONGODB_URI=mongodb://localhost:27017/checkinapp
PORT=3000
BASIC_AUTH_USER=yourusername
BASIC_AUTH_PASS=yourpassword
```
-> MONGODB_URI: Your MongoDB connection string. Ensure MongoDB is running locally or provide the connection string to a remote MongoDB instance.

-> PORT: The port on which the server will run. Default is 3000.

-> BASIC_AUTH_USER and BASIC_AUTH_PASS: Credentials for basic authentication to download logs. Replace with your own credentials.


### 4. Create the Required Directories
If the public directory does not exist, it will be created automatically, but you may want to ensure it is present.
```bash
mkdir -p public/views
```
### 5. Run the Server
Start the server with the following command:
```bash
npm start
```
The server will be running at http://localhost:3000. You can access the following routes:

Check-In: /checkin

Check-Out: /checkout

Log: /log

### 6. Basic Authentication for Downloading Logs
To download the log file, basic authentication is required. Use the credentials specified in the .env file.

### 7. Testing and Validation
Test your routes to ensure they work as expected.
Ensure that data is being correctly recorded in MongoDB and that the CSV download functionality works.

### Troubleshooting
MongoDB Connection Error: Ensure MongoDB is running and that the connection URI in the .env file is correct.
Missing Dependencies: Run npm install to ensure all required packages are installed.

### Contributing
If you want to contribute to this project, please fork the repository and submit a pull request with your changes.

### Contact
For any questions or issues, please contact me via GitHub.
