const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const basicAuth = require('basic-auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();

// MongoDB connection
mongoose.connect('mongodb+srv://admin:admin@checkin.ketzwii.mongodb.net/?retryWrites=true&w=majority&appName=Checkin');


const recordSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  action: String,
  timestamp: { type: Date, default: Date.now },
});

const Record = mongoose.model('Record', recordSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/views')); // Set the views directory to 'public/views'
app.use(express.urlencoded({ extended: false })); // This replaces the body-parser middleware
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the public directory exists
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// Authentication middleware
const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (user && user.name === 'admin' && user.pass === 'admin') {
    return next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }
};

app.get('/', (req, res) => {
  res.redirect('/checkin');
});

app.get('/checkin', async (req, res) => {
  const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
  res.render('checkin', { records, errorMessage: null });
});

app.post('/checkin', async (req, res) => {
  const { first_name, last_name } = req.body;

  // Check if the user is already checked in
  const existingCheckIn = await Record.findOne({
    first_name,
    last_name,
    action: 'Check-In',
  }).sort({ _id: -1 }).exec();

  const existingCheckOut = await Record.findOne({
    first_name,
    last_name,
    action: 'Check-Out',
  }).sort({ _id: -1 }).exec();

  if (existingCheckIn && (!existingCheckOut || existingCheckIn.timestamp > existingCheckOut.timestamp)) {
    const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
    return res.render('checkin', {
      records,
      errorMessage: 'User is already checked in.',
    });
  }

  const newRecord = new Record({ first_name, last_name, action: 'Check-In' });
  await newRecord.save();
  res.redirect('/checkin');
});

app.get('/checkout', async (req, res) => {
  const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
  
  const checkInRecords = await Record.find({ action: 'Check-In' }).exec();
  const checkOutRecords = await Record.find({ action: 'Check-Out' }).exec();
  
  const currentlyCheckedIn = checkInRecords.filter(record => 
    !checkOutRecords.some(outRecord => 
      outRecord.first_name === record.first_name && outRecord.last_name === record.last_name && outRecord.timestamp > record.timestamp
    )
  );
  
  const uniqueUsers = [...new Set(currentlyCheckedIn.map(record => `${record.first_name} ${record.last_name}`))];

  res.render('checkout', { records, uniqueUsers, errorMessage: null });
});

app.post('/checkout', async (req, res) => {
  const { user } = req.body;
  const nameParts = user.split(' ');
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ');

  const existingCheckIn = await Record.findOne({
    first_name,
    last_name,
    action: 'Check-In',
  }).sort({ _id: -1 }).exec();

  const existingCheckOut = await Record.findOne({
    first_name,
    last_name,
    action: 'Check-Out',
  }).sort({ _id: -1 }).exec();

  if (!existingCheckIn || (existingCheckOut && existingCheckOut.timestamp > existingCheckIn.timestamp)) {
    const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
    const checkInRecords = await Record.find({ action: 'Check-In' }).exec();
    const checkOutRecords = await Record.find({ action: 'Check-Out' }).exec();
  
    const currentlyCheckedIn = checkInRecords.filter(record => 
      !checkOutRecords.some(outRecord => 
        outRecord.first_name === record.first_name && outRecord.last_name === record.last_name && outRecord.timestamp > record.timestamp
      )
    );
    const uniqueUsers = [...new Set(currentlyCheckedIn.map(record => `${record.first_name} ${record.last_name}`))];

    return res.render('checkout', {
      records,
      uniqueUsers,
      errorMessage: 'User is not currently checked in.',
    });
  }

  const newRecord = new Record({ first_name, last_name, action: 'Check-Out' });
  await newRecord.save();
  res.redirect('/checkout');
});

app.get('/log', async (req, res) => {
  const records = await Record.find().sort({ _id: -1 }).limit(20).exec();
  res.render('log', { records, limit: 20 });
});

app.get('/log/filter', async (req, res) => {
  const { first_name, last_name, action, limit } = req.query;
  const query = {};
  if (first_name) query.first_name = first_name;
  if (last_name) query.last_name = last_name;
  if (action) query.action = action;

  const records = await Record.find(query)
    .sort({ _id: -1 })
    .limit(Number(limit))
    .exec();
  res.render('log', { records, limit: Number(limit) });
});

app.get('/log/download', auth, async (req, res) => {
  const records = await Record.find().sort({ _id: -1 }).exec();

  const csvWriter = createCsvWriter({
    path: 'public/records.csv',
    header: [
      { id: 'first_name', title: 'First Name' },
      { id: 'last_name', title: 'Last Name' },
      { id: 'action', title: 'Action' },
      { id: 'timestamp', title: 'Timestamp' },
    ],
  });

  await csvWriter.writeRecords(records).then(() => {
    res.download('public/records.csv', 'records.csv', (err) => {
      if (err) {
        res.status(500).send('Error downloading the file.');
      }
    });
  }).catch(err => {
    console.error('Error generating the CSV file: ', err);
    res.status(500).send('Error generating the CSV file.');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
