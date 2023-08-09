const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require('firebase-admin');

const app = express();
app.use(cors());

admin.initializeApp();
const db = admin.firestore();


// Retreieves all of the reminders for a given userID
app.get('/getReminders', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  try {
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    const remindersSnapshot = await userDocRef.collection('Reminders').get();
    const reminders = remindersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(reminders);
  } catch (error) {
    console.error('Error fetching reminders from Firestore:', error);
    res.status(500).json({ message: 'Error fetching reminders from Firestore' });
  }
});


// Deletes all reminders with an associated User
app.post('/deleteReminders', async (req, res) => {
  const userId = req.body.userId;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  // Log the received user ID
  console.log('Received user ID: ', userId);

  try {
    // Check if the user exists in Firestore
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    // Delete all reminders in the 'Reminders' subcollection of the user
    const remindersSnapshot = await userDocRef.collection('Reminders').get();
    const batch = db.batch();

    remindersSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.status(200).json({ message: 'All reminders deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminders from Firestore:', error);
    res.status(500).json({ message: 'Error deleting reminders from Firestore' });
  }
});


// Adds reminders to the database and stores datetime in a Timebase collection
app.post('/addReminder', async (req, res) => {
  const userId = req.body.userId;
  const datetime = req.body.datetime;
  const message = req.body.message;

  if (!userId || !datetime || !message) {
    res.status(400).json({ message: 'Missing required parameters' });
    return;
  }

  // Log the received parameters
  console.log('Received user ID: ', userId);
  console.log('Received datetime: ', datetime);
  console.log('Received message: ', message);

  try {
    // Check if the user exists in Firestore
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    // Add the reminder to the 'Reminders' subcollection of the user
    const reminderData = {
      datetime: datetime,
      message: message,
    };
    await db.collection('Users').doc(userId).collection('Reminders').add(reminderData);

    // Add the datetime to the 'Timebase' subcollection of the user
    const timebaseData = {
      datetime: datetime,
    };
    await db.collection('Users').doc(userId).collection('Timebase').add(timebaseData);

    res.status(200).json({ message: 'Reminder and Timebase entry added successfully' });
  } catch (error) {
    console.error('Error adding reminder and Timebase entry to Firestore:', error);
    res.status(500).json({ message: 'Error adding reminder and Timebase entry to Firestore' });
  }
});



// Obtains user ID and creates a user in the Database
app.post('/storeUserId', async (req, res) => {
  const userId = req.body.userId;
  const fullName = req.body.fullName;
  const phoneNumber = req.body.phoneNumber;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  // Log the received user ID
  console.log('Received user ID: ', userId);
  console.log('Received full Name: ', fullName);
  console.log('Received phone Number: ', phoneNumber);

  // Split the full name into first and last names
  const [firstName, ...lastNameParts] = fullName.split(' ');
  const lastName = lastNameParts.join(' ');

  // Save the user information in Firestore
  try {
    await db.collection('Users').doc(userId).set({
      userID: userId,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber.countryCode + phoneNumber.phoneNumber,
    });

    res.status(200).json({ message: 'User ID received and processed' });
  } catch (error) {
    console.error('Error saving user data to Firestore:', error);
    res.status(500).json({ message: 'Error saving user data to Firestore' });
  }
});

// Endpoint to get all users
app.get('/getUsers', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('Users').get();
    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: data.userID,
        fullName: `${data.firstName} ${data.lastName}`,
        phoneNumber: data.phoneNumber,
      };
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error retrieving users from Firestore:', error);
    res.status(500).json({ message: 'Error retrieving users from Firestore' });
  }
});



// Deletes all values in the Timebase collection for a given user ID
app.post('/deleteTimebase', async (req, res) => {
  const userId = req.body.userId;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  try {
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    const timebaseSnapshot = await userDocRef.collection('Timebase').get();
    const batch = db.batch();

    timebaseSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    res.status(200).json({ message: 'All Timebase entries deleted successfully' });
  } catch (error) {
    console.error('Error deleting Timebase entries from Firestore:', error);
    res.status(500).json({ message: 'Error deleting Timebase entries from Firestore' });
  }
});


// Retrieves the array of times associated with the given user ID
app.get('/getTimebase', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  try {
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    const timebaseSnapshot = await userDocRef.collection('Timebase').get();
    const timebaseArray = timebaseSnapshot.docs.map(doc => doc.data().datetime);

    res.status(200).json({ times: timebaseArray });
  } catch (error) {
    console.error('Error fetching Timebase from Firestore:', error);
    res.status(500).json({ message: 'Error fetching Timebase from Firestore' });
  }
});


// Retrieves the Timebase collection for a given user ID and returns an "isValid" integer
app.get('/isValidTime', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    res.status(400).json({ message: 'User ID Missing' });
    return;
  }

  try {
    const userDocRef = db.collection('Users').doc(userId);
    const userDocSnapshot = await userDocRef.get();

    if (!userDocSnapshot.exists) {
      res.status(400).json({ message: 'User not found' });
      return;
    }

    const timebaseSnapshot = await userDocRef.collection('Timebase').get();
    const timebaseArray = timebaseSnapshot.docs.map(doc => doc.data().datetime);

    // Default "isValid" integer value
    let isValid = 0;

    // Print the array of datetimes from the Timebase collection
    console.log('Timebase array:', timebaseArray);

    // Grabs the current time in eastern time
    const nowTime = Date.now();
    const estTime = nowTime - 4 * 60 * 60 * 1000;
    const estDate = new Date(estTime)

    // Initialize batch for deleting old values
    const batch = db.batch();

    // Checks if right now is within 8 minutes of any timebase reminder
    for (const doc of timebaseSnapshot.docs) {
      const datetime = doc.data().datetime;
      const date = new Date(datetime);
      const date8Min = new Date(date.getTime() + 8 * 60 * 1000);

      if (estDate > date && estDate < date8Min) {
        isValid = 1;
      }

      // If the date is in the past, add the document to the batch to be deleted
      if (estDate > date) {
        batch.delete(doc.ref);
      }
    }

    // Commit the batch to delete old values in Timebase
    await batch.commit();

    res.status(200).json({ isValid });
  } catch (error) {
    console.error('Error fetching Timebase from Firestore:', error);
    res.status(500).json({ message: 'Error fetching Timebase from Firestore' });
  }
});



exports.api = functions.https.onRequest(app);