require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const basicAuth = require('basic-auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const sanitize = require('mongo-sanitize');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const recordSchema = new mongoose.Schema({
  first_name: String,
  last_name: String,
  action: String,
  timestamp: { type: Date, default: Date.now },
});

const Record = mongoose.model('Record', recordSchema);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public/views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// Security middleware
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(cookieParser()); // Add this line
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Pass CSRF token to all views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (user && user.name === process.env.BASIC_AUTH_USER && user.pass === process.env.BASIC_AUTH_PASS) {
    return next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }
};

// Landing page route
app.get('/', (req, res) => {
  res.render('landing'); // Renders landing.ejs
});

// Check-in page route
app.get('/checkin', async (req, res) => {
  try {
    const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
    res.render('checkin', { records, errorMessage: null, successMessage: null });
  } catch (err) {
    console.error('Error fetching check-in records:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/checkin', [
  body('first_name').trim().escape().notEmpty().withMessage('First name is required'),
  body('last_name').trim().escape().notEmpty().withMessage('Last name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
    return res.render('checkin', { records, errorMessage: errors.array().map(err => err.msg).join(', '), successMessage: null });
  }

  const { first_name, last_name } = sanitize(req.body);

  try {
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
        successMessage: null
      });
    }

    const newRecord = new Record({ first_name, last_name, action: 'Check-In' });
    await newRecord.save();
    res.redirect('/');
  } catch (err) {
    console.error('Error during check-in:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Checkout page route
app.get('/checkout', async (req, res) => {
  try {
    const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
    const checkInRecords = await Record.find({ action: 'Check-In' }).exec();
    const checkOutRecords = await Record.find({ action: 'Check-Out' }).exec();
  
    const currentlyCheckedIn = checkInRecords.filter(record => 
      !checkOutRecords.some(outRecord => 
        outRecord.first_name === record.first_name && outRecord.last_name === record.last_name && outRecord.timestamp > record.timestamp
      )
    );
  
    // Create a list of unique users with their IDs
    const uniqueUsers = currentlyCheckedIn.map(record => ({
      _id: record._id,
      first_name: record.first_name,
      last_name: record.last_name
    }));
    res.render('checkout', { records, uniqueUsers, errorMessage: null, successMessage: null });
  } catch (err) {
    console.error('Error fetching checkout records:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/checkout', async (req, res) => {
  const { user } = sanitize(req.body);
  const userId = user; // Assuming `user` is an ID in this case

  try {
    const userRecord = await Record.findById(userId).exec();
    if (!userRecord || userRecord.action !== 'Check-In') {
      const records = await Record.find().sort({ _id: -1 }).limit(10).exec();
      const checkInRecords = await Record.find({ action: 'Check-In' }).exec();
      const checkOutRecords = await Record.find({ action: 'Check-Out' }).exec();
    
      const currentlyCheckedIn = checkInRecords.filter(record => 
        !checkOutRecords.some(outRecord => 
          outRecord.first_name === record.first_name && outRecord.last_name === record.last_name && outRecord.timestamp > record.timestamp
        )
      );
      const uniqueUsers = [...new Set(currentlyCheckedIn.map(record => ({
        _id: record._id,
        first_name: record.first_name,
        last_name: record.last_name
      })))];

      return res.render('checkout', {
        records,
        uniqueUsers,
        errorMessage: 'User is not currently checked in.',
        successMessage: null
      });
    }

    const newRecord = new Record({ first_name: userRecord.first_name, last_name: userRecord.last_name, action: 'Check-Out' });
    await newRecord.save();
    res.redirect('/');
  } catch (err) {
    console.error('Error during check-out:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Log page route
app.get('/log', async (req, res) => {
  try {
    const records = await Record.find().sort({ _id: -1 }).limit(20).exec();
    res.render('log', { records, limit: 20 });
  } catch (err) {
    console.error('Error fetching log records:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Log filter and download routes
app.get('/log/filter', [
  query('first_name').optional().trim().escape(),
  query('last_name').optional().trim().escape(),
  query('action').optional().trim().escape(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send('Invalid query parameters');
  }

  const { first_name, last_name, action, limit } = req.query;
  const query = {};
  if (first_name) query.first_name = first_name;
  if (last_name) query.last_name = last_name;
  if (action) query.action = action;

  try {
    const records = await Record.find(query)
      .sort({ _id: -1 })
      .limit(Number(limit))
      .exec();
    res.render('log', { records, limit: Number(limit) });
  } catch (err) {
    console.error('Error filtering log records:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/log/download', auth, async (req, res) => {
  try {
    const records = await Record.find().sort({ _id: -1 }).exec();
    const csvWriter = createCsvWriter({
      path: path.join(__dirname, 'public', 'log.csv'),
      header: [
        { id: 'first_name', title: 'First Name' },
        { id: 'last_name', title: 'Last Name' },
        { id: 'action', title: 'Action' },
        { id: 'timestamp', title: 'Timestamp' },
      ],
    });

    await csvWriter.writeRecords(records);
    res.download(path.join(__dirname, 'public', 'log.csv'));
  } catch (err) {
    console.error('Error generating log CSV:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
