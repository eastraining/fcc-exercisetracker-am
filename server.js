const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const DB_URI = process.env.DB_URI;
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(isSameOrAfter);
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);


app.use(cors());
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [{
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, required: true }
  }]
});
const UserModel = mongoose.model('User', userSchema);

app.route('/api/users')
.post(function(req, res) {
  let newUser = { username: req.body.username };
  UserModel.findOne(newUser, function(err, user) {
    if (err) {
      console.log(`Error with matching new username: ${err}`);
      res.send('Unable to verify new username');
    } else {
      if (user !== null) {
        res.send('Username is already taken');
      } else {
        newUser = new UserModel(newUser);
        newUser.save(function(err, user) {
          if (err) {
            console.log(`Error with saving new user: ${err}`);
          } else {
            res.json({
              _id: user._id,
              username: user.username
            });
          }
        })
      }
      
    }
  })
})
.get(function(req, res) {
  UserModel.find({}, 'username _id', function(err, users) {
    if (err) {
      console.log(`Error with retrieving list of users: ${err}`);
      res.send('Unable to find list of all users');
    } else {
      res.json(users);
    }
  })
})

app.route('/api/users/:id/exercises')
.post(function(req, res) {
  if (req.body.description === '') {
    res.send('Exercise description required');
    console.log(`Failed at description: ${req.body}`);
    return;
  }
  if (req.body.duration === '' || /[\D]/.test(req.body.duration)) {
    res.send('Exercise duration required');
    console.log(`Failed at duration: ${req.body}`);
    return;
  }
  console.log(`This should work: ${req.body}`);
  const excDate = dayjs(req.body.date, 'YYYY-MM-DD', true).isValid()?
  dayjs(req.body.date, 'YYYY-MM-DD').format('ddd MMM DD YYYY'):
  dayjs().format('ddd MMM DD YYYY'); // US time format required to pass tests
  const newExc = {
    description: req.body.description,
    duration: Number(req.body.duration),
    date: excDate
  };
  UserModel.findById(req.params.id, function(err, user) {
    if (err) {
      console.log(`Error with retrieving ID to add new exercise: ${err}`);
      res.send('id not found');
    } else {
      user.log.push(newExc);
      user.save(function(err, user) {
        if (err) {
            console.log(`Error with updating user to add new exercise: ${err}`);
            res.send('Unexpected error with adding new exercise');
          } else {
            res.json({
              _id: user._id,
              username: user.username,
              ...newExc
            });
          }
      });
    }
  });
});

app.route('/api/users/:id/logs')
.get(function(req, res) {
  UserModel.findById(req.params.id, '-log._id', function(err, user) {
    if (err) {
      console.log(`Error with retrieving ID to display exercise log: ${err}`);
      res.send('id not found');
    } else {
      const limit = /[\D]/.test(req.query.limit)?
      null : Number(req.query.limit);
      const returnLog = user.log
      .filter(x => {
        const xDate = dayjs(x.date);
        const fromDate = dayjs(req.query.from, 'YYYY-MM-DD', true).isValid()?
        dayjs(req.query.from, 'YYYY-MM-DD') : null;
        const toDate = dayjs(req.query.to, 'YYYY-MM-DD', true).isValid()?
        dayjs(req.query.to, 'YYYY-MM-DD') : null;
        return (fromDate ? xDate.isSameOrAfter(fromDate, 'day') : true) && 
        (toDate ? xDate.isSameOrBefore(toDate, 'day') : true);
      })
      .map(x => {
        return { 
          description: x.description,
          duration: x.duration,
          date: dayjs(x.date).format('ddd MMM DD YYYY') // US time format required
        }
      })
      .slice(0, Number.isInteger(limit)?
      limit : user.log.length);
      
      res.json({
        _id: user._id,
        username: user.username,
        count: returnLog.length,
        log: returnLog
      });
    }
  })
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
