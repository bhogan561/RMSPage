//Local VS Code + clasp test

function doPost(e) {
  // Helpful logging for debugging
  try {
    Logger.log('Received POST: %s', JSON.stringify(e));

    // Parse incoming data: support application/json or form-encoded
    let data;
    if (e.postData && e.postData.type && e.postData.type.indexOf('application/json') === 0) {
      data = JSON.parse(e.postData.contents);
    } else {
      // e.parameter contains single values; e.parameters contains arrays
      data = {};
      for (let key in e.parameter) {
        data[key] = e.parameter[key];
      }
    }

    // Prepare sheet write
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'Submission Log';
    const settingsName = 'Settings';

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // optional: set headers
      sheet.appendRow(['Timestamp','Name','Email', 'Phone Number', 'Message','RawPayload']);
    }

    let settingsSheet = ss.getSheetByName(settingsName);
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(settingsName);
      // optional: set headers
      settingsSheet.appendRow(['Notify','Subscribe']);
    }

    const ts = new Date();
    const name = data.name || data.fullName || '';
    const email = data.email || '';
    const phone = data.phone || '';
    const message = data.message || data.msg || '';
    const subscribe = data.subscribe || '';
    const raw = JSON.stringify(data);

    // Append a row
    sheet.appendRow([ts, name, email, phone, message, raw]);

    /**if(subscribe){
      let subList = settingsSheet.getRange("B2:B").getValues().flat().filter(Boolean);
      subList.push(email);
      settingsSheet.getRange("B2:B").clearContent();
      settingsSheet.getRange(2, 2, subList.length).setValues([subList]);
    }*/

    // Send notification email(s)
    const subject = 'New contact form submission';
    const body =
      'A new submission was received:\n\n' +
      'Timestamp: ' + ts.toString() + '\n' +
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Phone: ' + phone + '\n' + 
      //'Subscribe: ' + subscribe + '\n' +
      '\nMessage:\n' + message + '\n\n';
      //'Raw payload:\n' + raw;

    // Recipients: put a single "to" and use BCC, or send to a list (watch quotas)
    const RECIPIENTS = settingsSheet.getRange("A2:A").getValues().flat().filter(Boolean);
    MailApp.sendEmail({
      to: RECIPIENTS.join(','),
      subject: subject,
      body: body
    });

    // Return JSON success
    const result = { status: 'success' };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('Error in doPost: %s', err.toString());
    const result = { status: 'error', message: err.toString() };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'webapp reachable' }))
    .setMimeType(ContentService.MimeType.JSON);
}