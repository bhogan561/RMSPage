const assert = require('node:assert/strict');
const test = require('node:test');
const appsScript = require('../apps-script/Code.js');

function createSheet(name, rangeValues = []) {
    return {
        name,
        rangeValues,
        rows: [],
        appendRow(row) {
            this.rows.push(row);
        },
        getRange(range) {
            assert.equal(range, 'A2:A');
            return {
                getValues: () => this.rangeValues
            };
        }
    };
}

function createSpreadsheet(initialSheets = {}) {
    const sheets = new Map(Object.entries(initialSheets));

    return {
        sheets,
        getSheetByName(name) {
            return sheets.get(name) || null;
        },
        insertSheet(name) {
            const sheet = createSheet(name);
            sheets.set(name, sheet);
            return sheet;
        }
    };
}

function installAppsScriptGlobals(spreadsheet, sentEmails = []) {
    global.Logger = {
        messages: [],
        log(...args) {
            this.messages.push(args);
        }
    };

    global.SpreadsheetApp = {
        getActiveSpreadsheet: () => spreadsheet
    };

    global.MailApp = {
        sendEmail: email => sentEmails.push(email)
    };

    global.ContentService = {
        MimeType: {
            JSON: 'application/json'
        },
        createTextOutput(content) {
            return {
                content,
                mimeType: null,
                setMimeType(mimeType) {
                    this.mimeType = mimeType;
                    return this;
                }
            };
        }
    };
}

function parseResponse(response) {
    return {
        body: JSON.parse(response.content),
        mimeType: response.mimeType
    };
}

test('parseSubmissionEvent supports JSON and form-encoded events', () => {
    assert.deepEqual(appsScript.parseSubmissionEvent({
        postData: {
            type: 'application/json; charset=utf-8',
            contents: '{"name":"JSON User","message":"From JSON"}'
        }
    }), {
        name: 'JSON User',
        message: 'From JSON'
    });

    assert.deepEqual(appsScript.parseSubmissionEvent({
        parameter: {
            email: 'form@example.com',
            name: 'Form User'
        }
    }), {
        email: 'form@example.com',
        name: 'Form User'
    });
});

test('buildSubmission normalizes fields and preserves raw payload', () => {
    const timestamp = new Date('2026-06-17T12:00:00.000Z');
    const submission = appsScript.buildSubmission({
        email: 'fallback@example.com',
        fullName: 'Fallback Name',
        msg: 'Fallback message'
    }, timestamp);

    assert.deepEqual(submission, {
        timestamp,
        name: 'Fallback Name',
        email: 'fallback@example.com',
        phone: '',
        message: 'Fallback message',
        raw: '{"email":"fallback@example.com","fullName":"Fallback Name","msg":"Fallback message"}'
    });
});

test('doPost creates missing sheets, appends submissions, and sends notification email', () => {
    const spreadsheet = createSpreadsheet();
    const sentEmails = [];
    installAppsScriptGlobals(spreadsheet, sentEmails);

    const response = appsScript.doPost({
        parameter: {
            name: 'Jane Manager',
            email: 'jane@example.com',
            phone: '(555) 123-4567',
            message: 'Need monitoring'
        }
    });

    const parsed = parseResponse(response);
    const submissionSheet = spreadsheet.getSheetByName(appsScript.SUBMISSION_SHEET_NAME);
    const settingsSheet = spreadsheet.getSheetByName(appsScript.SETTINGS_SHEET_NAME);

    assert.deepEqual(parsed, {
        body: { status: 'success' },
        mimeType: 'application/json'
    });
    assert.deepEqual(submissionSheet.rows[0], appsScript.SUBMISSION_HEADERS);
    assert.equal(submissionSheet.rows[1][1], 'Jane Manager');
    assert.equal(submissionSheet.rows[1][2], 'jane@example.com');
    assert.equal(submissionSheet.rows[1][3], '(555) 123-4567');
    assert.equal(submissionSheet.rows[1][4], 'Need monitoring');
    assert.deepEqual(settingsSheet.rows[0], appsScript.SETTINGS_HEADERS);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, '');
    assert.equal(sentEmails[0].subject, 'New contact form submission');
    assert.match(sentEmails[0].body, /Jane Manager/);
    assert.match(sentEmails[0].body, /Need monitoring/);
});

test('doPost uses configured non-empty recipients from the Settings sheet', () => {
    const submissionSheet = createSheet(appsScript.SUBMISSION_SHEET_NAME);
    const settingsSheet = createSheet(appsScript.SETTINGS_SHEET_NAME, [
        ['first@example.com'],
        [''],
        ['second@example.com']
    ]);
    const spreadsheet = createSpreadsheet({
        [appsScript.SUBMISSION_SHEET_NAME]: submissionSheet,
        [appsScript.SETTINGS_SHEET_NAME]: settingsSheet
    });
    const sentEmails = [];
    installAppsScriptGlobals(spreadsheet, sentEmails);

    const response = appsScript.doPost({
        postData: {
            type: 'application/json',
            contents: JSON.stringify({
                fullName: 'JSON Lead',
                email: 'lead@example.com',
                msg: 'JSON message'
            })
        }
    });

    const parsed = parseResponse(response);

    assert.deepEqual(parsed.body, { status: 'success' });
    assert.equal(submissionSheet.rows.length, 1);
    assert.equal(submissionSheet.rows[0][1], 'JSON Lead');
    assert.equal(submissionSheet.rows[0][4], 'JSON message');
    assert.equal(sentEmails[0].to, 'first@example.com,second@example.com');
});

test('doPost returns an error response when dependencies fail', () => {
    installAppsScriptGlobals({
        getSheetByName() {
            throw new Error('spreadsheet unavailable');
        }
    });

    const response = appsScript.doPost({ parameter: {} });
    const parsed = parseResponse(response);

    assert.equal(parsed.mimeType, 'application/json');
    assert.equal(parsed.body.status, 'error');
    assert.match(parsed.body.message, /spreadsheet unavailable/);
});

test('doGet returns a health-check response', () => {
    installAppsScriptGlobals(createSpreadsheet());

    const response = appsScript.doGet({});
    const parsed = parseResponse(response);

    assert.deepEqual(parsed, {
        body: {
            status: 'ok',
            message: 'webapp reachable'
        },
        mimeType: 'application/json'
    });
});
