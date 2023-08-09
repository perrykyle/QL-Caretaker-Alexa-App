FIREBASE BACKEND EXPRESS FUNCTIONS -- OVERVIEW
 - We decided on using firebase to store and deal with our backend requests since you can make
   API requests from the alexa skill, and therefore it would be easier to communicate to the application

Here's a breakdown of every endpoint in order:

GET /getReminders:
 - Input:
   - Alexa userID: "string"
 - Output:
   - Array of reminders

The purpose of this is for the alexa skill to get all of the reminders in order to add it to
the reminders for the user. This accesses the database and pulls everything under the provided
userID's collection labeled "Reminders"


POST /deleteReminders:
 - Input:
   - Alexa userID: "string"
 - Output:
   - Status code and message indicating successful or unsuccessful deletion of reminders

This endpoint when called deletes every reminder associated with a userID. After the Alexa adds
all of the reminders to the users account, it deletes every reminder so it cannot be added again


POST /addReminder:
 - Input:
   - Alexa userID: "string"
   - datetime: "string"
   - message: "string"
 - Output:
   - Status code and message indicating successful or unsuccessful reminder creation
 
This endpoint will add reminders from the caretakers application into the reminders database under
the provided userID. It will also add the value to the "timebase" collection associate with the
userID, which is used to help the user acknowledge actions required by the caretaker.


POST /storeUserId
 - Input:
   - Alexa userID: "string"
   - fullName: "string"
   - phoneNumber: "object"
 - Output:
   - Status code and message indicating successful or unsuccessful user ID storage

This endpoint anticipates information coming from the Alexa "StoreUserID" intent. When this is envoked,
firebase will automatically create a new entity in firestore indicating that a new person has been created.
This is automatically referenced in the application and will update caretakers automatically.


GET /getUsers
 - Input:
   - null
 - Output:
  - Array consisting of objects representing people from firestore

This endpoint is called in a hook in the application that checks for all users when the app is loaded up,
when the app is loaded it will add all of the users to a list and display their full names for the caretakers
to see and choose who they want to add reminders for.


POST /deleteTimebase
 - Input: 
   - Alexa userID: "string"
 - Output:
   - Status code and message indicating successful or unsuccessful deletion of timebase values

The timebase is used to handle action acknowledgement from the user. Deleting the timebase resets the collection
to have no values. Only used in development***


GET /getTimebase
 - Input: 
   - Alexa userID: "string"
 - Output:
   - Array of datetime values from timebase

The opposite of /deleteTimebase. Gets the timebase datetime values associated with a user and returns them.
Only used in development***


GET /isValidTime
 - Input:
   - Alexa userID: "string"
 - Output:
   - Integer value 1 or 0

This is definitely the most difficult part of this backend Express API. When this is called, it will take the
current time, and compare it to every single value within the timebase. If the current time is within 8 minutes
after the timebase it will return a 1. If it before a timebase time or after 8 minutes after a timebase time - 
it will return 0. The goal of this is that the alexa application will be able to call this and determine if the
user can acknowledge an action, which the application will then delete the "annoying" reminders associated with 
the user.