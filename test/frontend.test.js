const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { initContactForm, WEBAPP_URL } = require('../docs/contact.js');

class FakeClassList {
    constructor(element, initialClassName = '') {
        this.element = element;
        this.names = new Set(initialClassName.split(/\s+/).filter(Boolean));
    }

    add(name) {
        this.names.add(name);
        this.sync();
    }

    remove(name) {
        this.names.delete(name);
        this.sync();
    }

    contains(name) {
        return this.names.has(name);
    }

    sync() {
        this.element._className = Array.from(this.names).join(' ');
    }
}

class FakeEvent {
    constructor(type, properties = {}) {
        this.type = type;
        this.defaultPrevented = false;
        Object.assign(this, properties);
    }

    preventDefault() {
        this.defaultPrevented = true;
    }
}

class FakeElement {
    constructor(tagName, properties = {}) {
        this.tagName = tagName.toUpperCase();
        this.attributes = {};
        this.children = [];
        this.eventListeners = {};
        this.ownerDocument = null;
        this.parentNode = null;
        this.disabled = false;
        this.inert = false;
        this.offsetParent = {};
        this.style = {};
        this.textContent = properties.textContent || '';
        this.value = properties.value || '';
        this._className = properties.className || '';
        this.classList = new FakeClassList(this, this._className);

        if (properties.id) {
            this.setAttribute('id', properties.id);
        }

        if (properties.href) {
            this.setAttribute('href', properties.href);
        }
    }

    get className() {
        return this._className;
    }

    set className(value) {
        this._className = value;
        this.classList = new FakeClassList(this, value);
    }

    appendChild(child) {
        child.parentNode = this;
        child.ownerDocument = this.ownerDocument;
        assignOwnerDocument(child, this.ownerDocument);
        this.children.push(child);
        return child;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'id') {
            this.id = String(value);
        }
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    addEventListener(type, listener) {
        this.eventListeners[type] = this.eventListeners[type] || [];
        this.eventListeners[type].push(listener);
    }

    async dispatchEvent(event) {
        event.target = event.target || this;
        event.currentTarget = this;
        const listeners = this.eventListeners[event.type] || [];
        await Promise.all(listeners.map(listener => listener(event)));
        return !event.defaultPrevented;
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }

    reset() {
        findAll(this, element => ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
            .forEach(element => {
                element.value = '';
            });
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        return findAll(this, element => element !== this && matchesSelector(element, selector));
    }
}

class FakeDocument {
    constructor() {
        this.activeElement = null;
        this.eventListeners = {};
        this.readyState = 'complete';
        this.body = new FakeElement('body');
        this.body.ownerDocument = this;
    }

    getElementById(id) {
        return findAll(this.body, element => element.id === id)[0] || null;
    }

    querySelector(selector) {
        return this.body.querySelector(selector);
    }

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }

    addEventListener(type, listener) {
        this.eventListeners[type] = this.eventListeners[type] || [];
        this.eventListeners[type].push(listener);
    }

    async dispatchEvent(event) {
        event.target = event.target || this;
        event.currentTarget = this;
        const listeners = this.eventListeners[event.type] || [];
        await Promise.all(listeners.map(listener => listener(event)));
        return !event.defaultPrevented;
    }
}

class FakeWindow {
    constructor() {
        this.eventListeners = {};
        this.console = {
            errors: [],
            error: (...args) => this.console.errors.push(args)
        };
    }

    addEventListener(type, listener) {
        this.eventListeners[type] = this.eventListeners[type] || [];
        this.eventListeners[type].push(listener);
    }

    async dispatchEvent(event) {
        event.target = event.target || this;
        event.currentTarget = this;
        const listeners = this.eventListeners[event.type] || [];
        await Promise.all(listeners.map(listener => listener(event)));
        return !event.defaultPrevented;
    }
}

function assignOwnerDocument(element, ownerDocument) {
    element.ownerDocument = ownerDocument;
    element.children.forEach(child => assignOwnerDocument(child, ownerDocument));
}

function findAll(root, predicate) {
    const matches = [];
    const visit = (element) => {
        if (predicate(element)) {
            matches.push(element);
        }

        element.children.forEach(visit);
    };

    visit(root);
    return matches;
}

function matchesSelector(element, selector) {
    if (selector === 'a[href="#contact"]') {
        return element.tagName === 'A' && element.getAttribute('href') === '#contact';
    }

    if (selector.includes('button:not([disabled])') || selector.includes('input:not([disabled])')) {
        return isFocusable(element);
    }

    if (selector.startsWith('.')) {
        return element.classList.contains(selector.slice(1));
    }

    if (selector.startsWith('#')) {
        return element.id === selector.slice(1);
    }

    return element.tagName.toLowerCase() === selector.toLowerCase();
}

function isFocusable(element) {
    if (element.disabled) {
        return false;
    }

    if (element.tagName === 'A') {
        return Boolean(element.getAttribute('href'));
    }

    return ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function element(tagName, properties) {
    return new FakeElement(tagName, properties);
}

function buildFixture(overrides = {}) {
    const document = new FakeDocument();
    const window = new FakeWindow();
    const timers = [];
    const fixedNow = new Date('2026-06-17T15:30:00.000Z');
    const fetchCalls = [];

    const header = element('header');
    const navLink = element('a', { href: '#contact', textContent: 'Get a Quote' });
    header.appendChild(navLink);

    const section = element('section');
    const heroLink = element('a', { href: '#contact', textContent: 'Schedule a Building Walkthrough' });
    section.appendChild(heroLink);

    const footer = element('footer');
    const script = element('script');

    const modal = element('div', { id: 'contactModal', className: 'modal' });
    modal.setAttribute('aria-hidden', 'true');
    const modalContent = element('div', { className: 'modal-content' });
    const closeBtn = element('button', { className: 'close-btn', textContent: 'x' });
    const form = element('form', { id: 'contactForm' });
    const name = element('input', { id: 'name', value: 'Jane Manager' });
    const email = element('input', { id: 'email', value: 'jane@example.com' });
    const phone = element('input', { id: 'phone', value: '(555) 123-4567' });
    const message = element('textarea', { id: 'message', value: 'Need monitoring' });
    const submit = element('button', { id: 'submitBtn', textContent: 'Submit Request' });
    const status = element('div', { id: 'formStatus' });

    form.appendChild(name);
    form.appendChild(email);
    form.appendChild(phone);
    form.appendChild(message);
    form.appendChild(submit);
    form.appendChild(status);
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);

    document.body.appendChild(header);
    document.body.appendChild(section);
    document.body.appendChild(footer);
    document.body.appendChild(modal);
    document.body.appendChild(script);

    const fetch = overrides.fetch || (async (url, options) => {
        fetchCalls.push({ url, options });
        return { ok: true };
    });

    const controller = initContactForm({
        document,
        fetch,
        now: () => fixedNow,
        setTimeout: (callback, delay) => timers.push({ callback, delay }),
        window
    });

    return {
        controller,
        document,
        elements: {
            closeBtn,
            email,
            footer,
            form,
            header,
            heroLink,
            message,
            modal,
            name,
            navLink,
            phone,
            script,
            section,
            status,
            submit
        },
        fetchCalls,
        fixedNow,
        timers,
        window
    };
}

test('index.html wires the contact script and required form elements', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

    assert.match(html, /<script src="contact\.js"><\/script>/);
    assert.match(html, /href="#contact"/);

    [
        'contactModal',
        'contactForm',
        'name',
        'email',
        'phone',
        'message',
        'submitBtn',
        'formStatus'
    ].forEach(id => {
        assert.match(html, new RegExp(`id="${id}"`));
    });
});

test('contact modal opens from contact links and closes accessibly', async () => {
    const { document, elements, timers } = buildFixture();
    const clickEvent = new FakeEvent('click');

    await elements.navLink.dispatchEvent(clickEvent);

    assert.equal(clickEvent.defaultPrevented, true);
    assert.equal(elements.modal.classList.contains('active'), true);
    assert.equal(elements.modal.getAttribute('aria-hidden'), 'false');
    assert.equal(elements.header.inert, true);
    assert.equal(elements.section.inert, true);
    assert.equal(elements.footer.inert, true);
    assert.equal(elements.script.inert, false);
    assert.equal(document.activeElement, elements.closeBtn);

    await elements.closeBtn.dispatchEvent(new FakeEvent('click'));

    assert.equal(elements.modal.classList.contains('active'), false);
    assert.equal(elements.modal.getAttribute('aria-hidden'), 'true');
    assert.equal(elements.header.inert, false);
    assert.equal(elements.section.inert, false);
    assert.equal(elements.footer.inert, false);
    assert.equal(document.activeElement, elements.navLink);
    assert.equal(timers.at(-1).delay, 300);
});

test('keyboard handling closes on escape and traps tab focus inside the modal', async () => {
    const { document, elements } = buildFixture();

    await elements.heroLink.dispatchEvent(new FakeEvent('click'));

    document.activeElement = elements.closeBtn;
    const shiftTab = new FakeEvent('keydown', { key: 'Tab', shiftKey: true });
    await document.dispatchEvent(shiftTab);

    assert.equal(shiftTab.defaultPrevented, true);
    assert.equal(document.activeElement, elements.submit);

    const tab = new FakeEvent('keydown', { key: 'Tab', shiftKey: false });
    await document.dispatchEvent(tab);

    assert.equal(tab.defaultPrevented, true);
    assert.equal(document.activeElement, elements.closeBtn);

    const escape = new FakeEvent('keydown', { key: 'Escape' });
    await document.dispatchEvent(escape);

    assert.equal(escape.defaultPrevented, true);
    assert.equal(elements.modal.classList.contains('active'), false);
});

test('successful form submission sends url-encoded payload and resets the form', async () => {
    const { elements, fetchCalls, fixedNow, timers } = buildFixture();

    await elements.heroLink.dispatchEvent(new FakeEvent('click'));
    await elements.form.dispatchEvent(new FakeEvent('submit'));

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, WEBAPP_URL);
    assert.equal(fetchCalls[0].options.method, 'POST');
    assert.deepEqual(fetchCalls[0].options.headers, {
        'Content-Type': 'application/x-www-form-urlencoded'
    });

    const params = new URLSearchParams(fetchCalls[0].options.body);
    assert.equal(params.get('name'), 'Jane Manager');
    assert.equal(params.get('email'), 'jane@example.com');
    assert.equal(params.get('phone'), '(555) 123-4567');
    assert.equal(params.get('message'), 'Need monitoring');
    assert.equal(params.get('timestamp'), fixedNow.toISOString());

    assert.equal(elements.status.textContent, 'Success! We will be in touch shortly.');
    assert.equal(elements.status.className, 'status-success');
    assert.equal(elements.name.value, '');
    assert.equal(elements.email.value, '');
    assert.equal(elements.phone.value, '');
    assert.equal(elements.message.value, '');
    assert.equal(elements.submit.textContent, 'Submit Request');
    assert.equal(elements.submit.disabled, false);

    const closeTimer = timers.find(timer => timer.delay === 3000);
    closeTimer.callback();
    assert.equal(elements.modal.classList.contains('active'), false);
});

test('failed form submission shows an error and preserves entered form values', async () => {
    const { elements, window } = buildFixture({
        fetch: async () => ({ ok: false })
    });

    await elements.form.dispatchEvent(new FakeEvent('submit'));

    assert.equal(elements.status.textContent, 'Something went wrong. Please try again.');
    assert.equal(elements.status.className, 'status-error');
    assert.equal(elements.submit.textContent, 'Submit Request');
    assert.equal(elements.submit.disabled, false);
    assert.equal(elements.name.value, 'Jane Manager');
    assert.equal(elements.email.value, 'jane@example.com');
    assert.equal(elements.phone.value, '(555) 123-4567');
    assert.equal(elements.message.value, 'Need monitoring');
    assert.equal(window.console.errors.length, 1);
});
