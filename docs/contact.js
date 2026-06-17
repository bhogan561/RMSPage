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

        if (!modal || !modalContent || !closeBtn || !contactForm || !submitBtn || !formStatus) {
            return null;
        }

        const fetchImpl = resolveFetch(windowRef, options.fetch);
        const setTimeoutFn = resolveSetTimeout(windowRef, options.setTimeout);
        const now = options.now || (() => new Date());
        const consoleRef = options.console || (windowRef && windowRef.console) || console;
        const webappUrl = options.webappUrl || WEBAPP_URL;
        let modalTrigger = null;

        const getBackgroundElements = () => Array.from(documentRef.body.children)
            .filter(element => element !== modal && element.tagName !== 'SCRIPT');

        const setBackgroundInert = (isInert) => {
            getBackgroundElements().forEach(element => {
                element.inert = isInert;
            });
        };

        const getFocusableModalElements = () => Array.from(modalContent.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter(element => element.offsetParent !== null);

        const openModal = (trigger) => {
            modalTrigger = trigger;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            setBackgroundInert(true);

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

            if (modalTrigger && typeof modalTrigger.focus === 'function') {
                modalTrigger.focus();
            }

            setTimeoutFn(() => {
                formStatus.textContent = '';
                formStatus.className = '';
            }, 300);
        };

        const buildFormData = () => ({
            name: documentRef.getElementById('name').value,
            email: documentRef.getElementById('email').value,
            phone: documentRef.getElementById('phone').value,
            message: documentRef.getElementById('message').value,
            timestamp: now().toISOString()
        });

        const showSuccessMessage = () => {
            formStatus.textContent = 'Success! We will be in touch shortly.';
            formStatus.className = 'status-success';
            contactForm.reset();
            submitBtn.textContent = 'Submit Request';
            submitBtn.disabled = false;

            setTimeoutFn(closeModal, 3000);
        };

        documentRef.querySelectorAll('a[href="#contact"]').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                openModal(event.currentTarget);
            });
        });

        closeBtn.addEventListener('click', closeModal);

        windowRef.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

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

            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            formStatus.textContent = '';
            formStatus.className = '';

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
                formStatus.textContent = 'Something went wrong. Please try again.';
                formStatus.className = 'status-error';
                submitBtn.textContent = 'Submit Request';
                submitBtn.disabled = false;
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
            showSuccessMessage
        };
    }

    return {
        FOCUSABLE_SELECTOR,
        WEBAPP_URL,
        initContactForm
    };
});
