const Alexa = require('ask-sdk-core');
const https = require('https');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello, how may I assist you today?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


// Handler to call function to send user ID and full name to backend server
const StoreUserIDIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "StoreUserIDIntent"
    );
  },
  async handle(handlerInput) {
    // Gets the user ID, access token, and the API endpoint to gather all of the information required
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const accessToken = handlerInput.requestEnvelope.context.System.apiAccessToken;
    const apiEndpoint = handlerInput.requestEnvelope.context.System.apiEndpoint;
    
    // Establishes URLs to get user information
    const fullNameUrl = `${apiEndpoint}/v2/accounts/~current/settings/Profile.name`;
    const phoneNumberUrl = `${apiEndpoint}/v2/accounts/~current/settings/Profile.mobileNumber`;
    
    // Token headers
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${accessToken}`
    };

    try {
      // Gets name and number from user
      const fullName = await getRequest(fullNameUrl, headers);
      const phoneNumber = await getRequest(phoneNumberUrl, headers);

      // Parses data in JSON format
      const data = JSON.stringify({ userId: userId, fullName: fullName, phoneNumber: phoneNumber });

      await postData(data);
      return handlerInput.responseBuilder
        .speak("User ID and full name stored successfully.")
        .getResponse();
    } catch (error) {
      console.error("Error storing user ID and full name and phone number:", error);
      return handlerInput.responseBuilder
        .speak("An error occurred while storing the user ID and full name and phone number. Please try again.")
        .getResponse();
    }
  },
};
// Function to send get request to Amazon Customer Info API
function getRequest(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: headers }, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(data));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
  });
}
// Function to send user ID and other data to the backend of the server.
function postData(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "us-central1-expobackend-3d354.cloudfunctions.net",
      path: "/api/storeUserID",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsedBody = JSON.parse(body);
            resolve(parsedBody);
          } catch (error) {
            console.error("Error parsing response:", error);
            reject(error);
          }
        } else {
          reject(res.statusCode);
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}


// Handler which adds all reminders in database associated with user ID to the users alexa, along with 3 backup annoying reminders per reminder.
const GetRemindersIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetRemindersIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const url = `https://us-central1-expobackend-3d354.cloudfunctions.net/api/getReminders?userId=${encodeURIComponent(userId)}`;

    try {
      const reminders = await httpRequest(url);
      console.log('Fetched reminders:', reminders);

      for (const reminder of reminders) {
        const datetime = new Date(reminder.datetime);
        const min5time = new Date (datetime.getTime()+ 1000 + 5 * 60 * 1000);
        const min7time = new Date (datetime.getTime()+ 2000 + 7 * 60 * 1000);
        const min8time = new Date (datetime.getTime()+ 3000 + 8 * 60 * 1000);
        const message = reminder.message;
        await createReminder(handlerInput, datetime,'This is your first reminder to ' + message);
        await createReminder(handlerInput, min5time,'This is your second reminder to ' + message);
        await createReminder(handlerInput, min7time,'This is your third reminder to ' + message);
        await createReminder(handlerInput, min8time,'This is your final reminder to ' + message);
      }

      // Call the deleteReminders endpoint
      const deleteUrl = 'https://us-central1-expobackend-3d354.cloudfunctions.net/api/deleteReminders';
      const deleteData = JSON.stringify({ userId: userId });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };
      // Deletes reminders
      await new Promise((resolve, reject) => {
        const req = https.request(deleteUrl, options, (res) => {
          let responseBody = '';

          res.on('data', (chunk) => {
            responseBody += chunk;
          });

          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              console.error(`Status Code: ${res.statusCode}`);
              console.error(`Response Body: ${responseBody}`);
              return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            resolve();
          });
        });
        req.on('error', (err) => {
          reject(err);
        });
        req.write(deleteData);
        req.end();
      });

      return handlerInput.responseBuilder
        .speak('All your reminders have been scheduled')
        .getResponse();
    } catch (error) {
      console.error('Error fetching or scheduling reminders:', error);
      return handlerInput.responseBuilder
        .speak('There was an error fetching and scheduling your reminders.')
        .getResponse();
    }
  },
};
// Get Request handler specifically for backend server
function httpRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(JSON.parse(data));
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
  });
}
// Create reminder function 
const createReminder = async (handlerInput, date, message) => {
    const { requestEnvelope } = handlerInput;
    const consentToken = requestEnvelope.context.System.user.permissions.consentToken;
    if (!consentToken) {
        return handlerInput.responseBuilder
            .speak("Please enable reminder permissions in the Alexa app.")
            .getResponse();
    }
    try {
        const timeZone = "America/New_York";
        const scheduledTime = date.toISOString().slice(0, -5);

        const reminderRequest = {
            trigger: {
                type: "SCHEDULED_ABSOLUTE",
                scheduledTime: scheduledTime,
                timeZoneId: timeZone
            },
            alertInfo: {
                spokenInfo: {
                    content: [{
                        locale: "en-US",
                        text: message
                    }]
                }
            },
            pushNotification: {
                status: "ENABLED"
            }
        };

        const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
        const apiAccessToken = requestEnvelope.context.System.apiAccessToken;

        const options = {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiAccessToken}`
            }
        };

        const postRequest = (url, data, options) => {
            return new Promise((resolve, reject) => {
                const req = https.request(url, options, (res) => {
                    let responseBody = '';

                    res.on('data', (chunk) => {
                        responseBody += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            console.error(`Status Code: ${res.statusCode}`);
                            console.error(`Response Body: ${responseBody}`);
                            return reject(new Error(`Status Code: ${res.statusCode}`));
                        }

                        resolve();
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                req.write(JSON.stringify(data));
                req.end();
            });
        };
        await postRequest(`${apiEndpoint}/v1/alerts/reminders`, reminderRequest, options);
        const adjustedDate = new Date(date.getTime());
        const formattedDateTime = adjustedDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        return handlerInput.responseBuilder
            .speak(`I've scheduled a reminder for you at ${formattedDateTime}.`)
            .getResponse();
    } catch (error) {
        console.error(`Error occurred while creating reminder: ${error}`);
        return handlerInput.responseBuilder
            .speak("I'm sorry, I encountered an issue while scheduling your reminder. Please try again later.")
            .getResponse();
    }
};






// Intent handler which checks to see if you are within 8 minutes of a reminder, and if so, deletes the backup annoying reminders
const ConfirmActionIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConfirmActionIntent';
  },
  async handle(handlerInput) {
    const userId = handlerInput.requestEnvelope.context.System.user.userId;
    const url = `https://us-central1-expobackend-3d354.cloudfunctions.net/api/isValidTime?userId=${userId}`;

    try {
      const response = await httpRequest(url);
      const isValid = response.isValid;

      let speakOutput;
      
      const scheduledTimes = await getReminders(handlerInput);
      console.log('scheduled times from confirm action intent: ', scheduledTimes);

      if (isValid === 1) {
        speakOutput = 'Thank you for acknowledging, your backup reminders have been deleted and your caregiver has been notified.';

        for(let i = 0; i < 3; i++){
          const val = parseInt(scheduledTimes[i].scheduledTime.substring(17,19));
          if(val===3){
            for(let j = i; j > -1; j--){
              const alertToken = scheduledTimes[j].alertToken;
              await deleteReminder(handlerInput, alertToken);
            }
            break;
          }
        }
        
      } else {
        speakOutput = 'There is no action to acknowledge, please contact your caregiver with any questions.';
      }

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    } catch (error) {
      console.error('Error fetching isValidTime:', error);
      return handlerInput.responseBuilder
        .speak('An error occurred while checking the action time window.')
        .getResponse();
    }
  }
};








// Function which returns an array of reminders
async function getReminders(handlerInput) {
    const { requestEnvelope } = handlerInput;
    const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
    const apiAccessToken = requestEnvelope.context.System.apiAccessToken;

    const options = {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${apiAccessToken}`
        }
    };

    const getRequest = (url, options) => {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let responseBody = '';

                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        console.error(`Status Code: ${res.statusCode}`);
                        console.error(`Response Body: ${responseBody}`);
                        return reject(new Error(`Status Code: ${res.statusCode}`));
                    }

                    resolve(JSON.parse(responseBody));
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.end();
        });
    };

    try {
        const remindersResponse = await getRequest(`${apiEndpoint}/v1/alerts/reminders`, options);
        const reminders = remindersResponse.alerts.filter(reminder => reminder.status === 'ON');
        
        const scheduledTimes = reminders.map(reminder => {
          return {
            alertToken: reminder.alertToken,
            scheduledTime: reminder.trigger.scheduledTime
          };
        });
        
        scheduledTimes.sort((a, b) => {
          return new Date(a.scheduledTime) - new Date(b.scheduledTime);
        });

        //console.log('Scheduled Times: ', scheduledTimes);
        return scheduledTimes;
    } catch (error) {
        console.error('Error retrieving reminders:', error);
    }
}



// Function to contact alexa API and delete reminder by ID
async function deleteReminder(handlerInput, id) {
    const { requestEnvelope } = handlerInput;
    const apiEndpoint = requestEnvelope.context.System.apiEndpoint;
    const apiAccessToken = requestEnvelope.context.System.apiAccessToken;

    const options = {
        method: 'DELETE',
        headers: {
            "Authorization": `Bearer ${apiAccessToken}`
        }
    };

    const deleteRequest = (url, options) => {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    console.error(`Status Code: ${res.statusCode}`);
                    return reject(new Error(`Status Code: ${res.statusCode}`));
                }

                resolve();
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.end();
        });
    };

    try {
        await deleteRequest(`${apiEndpoint}/v1/alerts/reminders/${id}`, options);
    } catch (error) {
        console.error(`Error deleting reminder with id: ${id}`, error);
    }
}





// Intent handler which deletes all the created reminders in the alexa as well as the timebase values associated with the user ID in the database
const DeleteRemindersIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteRemindersIntent';
    },
    async handle(handlerInput) {
        const scheduledTimes = await getReminders(handlerInput);
        console.log('From the Test Reminder intent handler, here we go!: ', scheduledTimes);

        for (const reminder of scheduledTimes) {
            const alertToken = reminder.alertToken;
            await deleteReminder(handlerInput, alertToken);
        }

        // Get the user ID
        const userId = handlerInput.requestEnvelope.context.System.user.userId;

        // Prepare data for the POST request to your backend
        const data = JSON.stringify({ userId: userId });

        try {
            // Call the postDeleteTimebase function to delete Timebase entries for the given user ID
            await postDeleteTimebase(data);
            const speakOutput = 'Active reminders and Timebase entries have been deleted.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } catch (error) {
            console.error('Error deleting Timebase entries:', error);
            const speakOutput = 'An error occurred while deleting Timebase entries. Please try again.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }
    }
};





// postDeleteTimebase function to delete Timebase entries for a given user ID
function postDeleteTimebase(data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "us-central1-expobackend-3d354.cloudfunctions.net",
            path: "/api/deleteTimebase",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": data.length,
            },
        };

        const req = https.request(options, (res) => {
            let body = "";

            res.on("data", (chunk) => {
                body += chunk;
            });

            res.on("end", () => {
                if (res.statusCode === 200) {
                    try {
                        const parsedBody = JSON.parse(body);
                        resolve(parsedBody);
                    } catch (error) {
                        console.error("Error parsing response:", error);
                        reject(error);
                    }
                } else {
                    reject(res.statusCode);
                }
            });
        });

        req.on("error", (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// exports handler
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        StoreUserIDIntentHandler,
        GetRemindersIntentHandler,
        ConfirmActionIntentHandler,
        DeleteRemindersIntentHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();