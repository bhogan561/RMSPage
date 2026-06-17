const SUBMISSION_SHEET_NAME = 'Submission Log';
const SETTINGS_SHEET_NAME = 'Settings';
const SUBMISSION_HEADERS = ['Timestamp', 'Name', 'Email', 'Phone Number', 'Message', 'RawPayload'];
const SETTINGS_HEADERS = ['Notify'];

function parseSubmissionEvent(e) {
  if (e && e.postData && e.postData.type && e.postData.type.indexOf('application/json') === 0) {
    return JSON.parse(e.postData.contents);
  }

  const params = e && e.parameter ? e.parameter : {};
  const data = {};

  for (let key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      data[key] = params[key];
    }
  }

  return data;
}

function buildSubmission(data, timestamp) {
  return {
    timestamp: timestamp,
    name: data.name || data.fullName || '',
    email: data.email || '',
    phone: data.phone || '',
    message: data.message || data.msg || '',
    raw: JSON.stringify(data)
  };
}

function ensureSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }

  return sheet;
}

function appendSubmission(sheet, submission) {
  sheet.appendRow([
    submission.timestamp,
    submission.name,
    submission.email,
    submission.phone,
    submission.message,
    submission.raw
  ]);
}

function getRecipients(settingsSheet) {
  return settingsSheet.getRange('A2:A').getValues().flat().filter(Boolean);
}

function buildNotificationEmail(submission) {
  return {
    subject: 'New contact form submission',
    body:
      'A new submission was received:\n\n' +
      'Timestamp: ' + submission.timestamp.toString() + '\n' +
      'Name: ' + submission.name + '\n' +
      'Email: ' + submission.email + '\n' +
      'Phone: ' + submission.phone + '\n' +
      '\nMessage:\n' + submission.message + '\n\n'
  };
}

function jsonResponse(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    Logger.log('Received POST: %s', JSON.stringify(e));

    const data = parseSubmissionEvent(e);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionSheet = ensureSheet(ss, SUBMISSION_SHEET_NAME, SUBMISSION_HEADERS);
    const settingsSheet = ensureSheet(ss, SETTINGS_SHEET_NAME, SETTINGS_HEADERS);
    const submission = buildSubmission(data, new Date());

    appendSubmission(submissionSheet, submission);

    const recipients = getRecipients(settingsSheet);
    const email = buildNotificationEmail(submission);

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: email.subject,
      body: email.body
    });

    return jsonResponse({ status: 'success' });
  } catch (err) {
    Logger.log('Error in doPost: %s', err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'webapp reachable' });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SETTINGS_HEADERS,
    SETTINGS_SHEET_NAME,
    SUBMISSION_HEADERS,
    SUBMISSION_SHEET_NAME,
    appendSubmission,
    buildNotificationEmail,
    buildSubmission,
    doGet,
    doPost,
    ensureSheet,
    getRecipients,
    jsonResponse,
    parseSubmissionEvent
  };
}
