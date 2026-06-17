(function (root, factory) {
    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.RMSContactForm = api;

        if (root.document) {
            if (root.document.getElementById('contactModal')) {
                api.initContactForm({ document: root.document, window: root });
            } else {
                root.document.addEventListener('DOMContentLoaded', () => {
                    api.initContactForm({ document: root.document, window: root });
                }, { once: true });
            }
        }
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzU4LUkTUfGyS2eCsfZ6EH89rYWFcqLTMbgHlrRr2cyXTIESWcrTrrjd-Dd8TMGHdTs/exec';
    const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function resolveDocument(options) {
        return options.document || (typeof document !== 'undefined' ? document : null);
    }

    function resolveWindow(options) {
        return options.window || (typeof window !== 'undefined' ? window : {});
    }

    function resolveFetch(windowRef, fetchOverride) {
        if (fetchOverride) {
            return fetchOverride;
        }

        if (windowRef && typeof windowRef.fetch === 'function') {
            return windowRef.fetch.bind(windowRef);
        }

        if (typeof fetch === 'function') {
            return fetch;
        }

        return null;
    }

    function resolveSetTimeout(windowRef, setTimeoutOverride) {
        if (setTimeoutOverride) {
            return setTimeoutOverride;
        }

        if (windowRef && typeof windowRef.setTimeout === 'function') {
            return windowRef.setTimeout.bind(windowRef);
        }

        return setTimeout;
    }

    function initContactForm(options = {}) {
        const documentRef = resolveDocument(options);
        const windowRef = resolveWindow(options);

        if (!documentRef) {
            return null;
        }

        const modal = documentRef.getElementById('contactModal');
        const modalContent = modal ? modal.querySelector('.modal-content') : null;
        const closeBtn = modal ? modal.querySelector('.close-btn') : null;
        const contactForm = documentRef.getElementById('contactForm');
        const submitBtn = documentRef.getElementById('submitBtn');
        const formStatus = documentRef.getElementById('formStatus');
        const fields = {
            name: {
                element: documentRef.getElementById('name'),
                error: documentRef.getElementById('nameError'),
                requiredMessage: 'Enter your full name.'
            },
            email: {
                element: documentRef.getElementById('email'),
                error: documentRef.getElementById('emailError'),
                requiredMessage: 'Enter your email address.',
                invalidMessage: 'Enter an email address in the format name@example.com.'
            },
            phone: {
                element: documentRef.getElementById('phone'),
                error: documentRef.getElementById('phoneError'),
                requiredMessage: 'Enter your phone number.'
            },
            message: {
                element: documentRef.getElementById('message'),
                error: documentRef.getElementById('messageError'),
                requiredMessage: 'Tell us how we can help.'
            }
        };

        const requiredFieldElements = Object.values(fields)
            .flatMap(field => [field.element, field.error]);

        if (!modal || !modalContent || !closeBtn || !contactForm || !submitBtn || !formStatus || requiredFieldElements.some(element => !element)) {
            return null;
        }

        const fetchImpl = resolveFetch(windowRef, options.fetch);
        const setTimeoutFn = resolveSetTimeout(windowRef, options.setTimeout);
        const now = options.now || (() => new Date());
        const consoleRef = options.console || (windowRef && windowRef.console) || console;
        const webappUrl = options.webappUrl || WEBAPP_URL;
        const backgroundElementStates = new Map();
        let modalTrigger = null;

        const getBackgroundElements = () => Array.from(documentRef.body.children)
            .filter(element => element !== modal && element.tagName !== 'SCRIPT');

        const setBackgroundInert = (isInert) => {
            getBackgroundElements().forEach(element => {
                element.inert = isInert;

                if (isInert) {
                    if (!backgroundElementStates.has(element)) {
                        backgroundElementStates.set(element, element.getAttribute('aria-hidden'));
                    }

                    element.setAttribute('aria-hidden', 'true');
                    return;
                }

                const previousAriaHidden = backgroundElementStates.get(element);

                if (previousAriaHidden === undefined || previousAriaHidden === null) {
                    element.removeAttribute('aria-hidden');
                } else {
                    element.setAttribute('aria-hidden', previousAriaHidden);
                }

                backgroundElementStates.delete(element);
            });
        };

        const getFocusableModalElements = () => Array.from(modalContent.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter(element => element.offsetParent !== null);

        const setStatus = (message, className = '') => {
            formStatus.textContent = message;
            formStatus.className = className;
        };

        const setSubmitting = (isSubmitting) => {
            contactForm.setAttribute('aria-busy', String(isSubmitting));
            submitBtn.textContent = isSubmitting ? 'Sending...' : 'Submit Request';
            submitBtn.disabled = isSubmitting;
        };

        const clearFieldError = (field) => {
            field.error.textContent = '';
            field.element.removeAttribute('aria-invalid');
        };

        const setFieldError = (field, message) => {
            field.error.textContent = message;
            field.element.setAttribute('aria-invalid', 'true');
        };

        const clearValidationErrors = () => {
            Object.values(fields).forEach(clearFieldError);
        };

        const clearFormFeedback = () => {
            setStatus('');
            clearValidationErrors();
        };

        const getFieldValue = (fieldName) => fields[fieldName].element.value.trim();

        const validateForm = () => {
            clearValidationErrors();

            const invalidFields = [];

            Object.values(fields).forEach(field => {
                if (!field.element.value.trim()) {
                    setFieldError(field, field.requiredMessage);
                    invalidFields.push(field);
                }
            });

            if (fields.email.element.value.trim() && !EMAIL_PATTERN.test(fields.email.element.value.trim())) {
                setFieldError(fields.email, fields.email.invalidMessage);
                invalidFields.push(fields.email);
            }

            if (!invalidFields.length) {
                return true;
            }

            setStatus('Please correct the fields marked below.', 'status-error');
            invalidFields[0].element.focus();
            return false;
        };

        const openModal = (trigger) => {
            modalTrigger = trigger;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            setBackgroundInert(true);
            documentRef.body.classList.add('modal-open');

            const firstFocusableElement = getFocusableModalElements()[0] || closeBtn;
            firstFocusableElement.focus();
        };

        const closeModal = () => {
            if (!modal.classList.contains('active')) {
                return;
            }

            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            setBackgroundInert(false);
            documentRef.body.classList.remove('modal-open');

            if (modalTrigger && typeof modalTrigger.focus === 'function') {
                modalTrigger.focus();
            }

            setTimeoutFn(() => {
                clearFormFeedback();
            }, 300);
        };

        const buildFormData = () => ({
            name: getFieldValue('name'),
            email: getFieldValue('email'),
            phone: getFieldValue('phone'),
            message: getFieldValue('message'),
            timestamp: now().toISOString()
        });

        const showSuccessMessage = () => {
            clearValidationErrors();
            contactForm.reset();
            setSubmitting(false);
            setStatus('Success! We will be in touch shortly.', 'status-success');
        };

        documentRef.querySelectorAll('a[href="#contact"]').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                openModal(event.currentTarget);
            });
        });

        closeBtn.addEventListener('click', closeModal);

        if (windowRef && typeof windowRef.addEventListener === 'function') {
            windowRef.addEventListener('click', (event) => {
                if (event.target === modal) {
                    closeModal();
                }
            });
        }

        documentRef.addEventListener('keydown', (event) => {
            if (!modal.classList.contains('active')) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                closeModal();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusableElements = getFocusableModalElements();
            const firstFocusableElement = focusableElements[0];
            const lastFocusableElement = focusableElements[focusableElements.length - 1];

            if (!firstFocusableElement || !lastFocusableElement) {
                event.preventDefault();
                return;
            }

            if (event.shiftKey && documentRef.activeElement === firstFocusableElement) {
                event.preventDefault();
                lastFocusableElement.focus();
            } else if (!event.shiftKey && documentRef.activeElement === lastFocusableElement) {
                event.preventDefault();
                firstFocusableElement.focus();
            }
        });

        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            setStatus('');

            if (!validateForm()) {
                return;
            }

            setSubmitting(true);

            const formParams = new URLSearchParams(buildFormData()).toString();

            try {
                if (!fetchImpl) {
                    throw new Error('Fetch is unavailable');
                }

                const response = await fetchImpl(webappUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formParams
                });

                if (response.ok) {
                    showSuccessMessage();
                } else {
                    throw new Error('Network response was not ok');
                }
            } catch (error) {
                consoleRef.error('Error submitting form:', error);
                setStatus('Something went wrong. Your information is still in the form; please try again.', 'status-error');
                setSubmitting(false);
            }
        });

        return {
            buildFormData,
            closeModal,
            elements: {
                closeBtn,
                contactForm,
                formStatus,
                modal,
                modalContent,
                submitBtn
            },
            getBackgroundElements,
            getFocusableModalElements,
            openModal,
            showSuccessMessage,
            validateForm
        };
    }

    return {
        FOCUSABLE_SELECTOR,
        WEBAPP_URL,
        initContactForm
    };
});
