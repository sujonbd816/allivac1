// ==UserScript==
// @name         06. OTP ও Verify Date Time Captcha Show With Payment (Full Working + Auto Select)
// @namespace    https://payment.ivacbd.com/
// @version      3.9
// @description  OTP Send/Verify + Load Date, Time + Auto-select First Date/Time + Always Visible CAPTCHA + Reuse CAPTCHA & Abort Pending Requests + Pay Now Button + Redirect on Slot Booking
// @match        https://payment.ivacbd.com/*
// @exclude      https://payment.ivacbd.com/payment
// @exclude      https://payment.ivacbd.com/overview
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const activeRequests = new Map();
    const alarmSound = new Audio('https://www.soundjay.com/buttons/sounds/beep-04.mp3');
    let lastCaptchaHTML = null;

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
        if (this._url.includes('pay-slot-time') || this._url.includes('pay-otp-verify') || this._url.includes('pay-otp-sent')) {
            const reqEntry = { request: this, aborted: false };
            activeRequests.set(this, reqEntry);
            console.log(`Tracking request: ${this._url}`);

            this.addEventListener('readystatechange', () => {
                if (this.readyState === 4 && this.status === 200 && !reqEntry.aborted) {
                    console.log(`200 OK detected for: ${this._url}. Aborting all other pending requests.`);
                    alarmSound.play();
                    abortAllPendingRequests(this);
                }
            });
        }

        return originalSend.apply(this, arguments);
    };

    function abortAllPendingRequests(completedRequest) {
        activeRequests.forEach((entry, req) => {
            if (req !== completedRequest && req.readyState < 4) {
                req.abort();
                entry.aborted = true;
                console.log(`Aborted request to: ${req._url}`);
            }
        });
        activeRequests.clear();
    }

    function sendOTP() {
        let tokenElement = document.querySelector('input[name="_token"]');
        if (!tokenElement) return;
        let token = tokenElement.value;

        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://payment.ivacbd.com/pay-otp-sent', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(`_token=${encodeURIComponent(token)}&resend=0`);
    }

    function verifyOTP() {
        let tokenElement = document.querySelector('input[name="_token"]');
        let otpInput = document.getElementById('otp-input').value;
        if (!tokenElement || !otpInput) return;

        let token = tokenElement.value;
        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://payment.ivacbd.com/pay-otp-verify', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let response = JSON.parse(xhr.responseText);
                if (response.success) {
                    addAppointmentDates(response.data.slot_dates);
                }
            }
        };
        xhr.send(`_token=${encodeURIComponent(token)}&otp=${encodeURIComponent(otpInput)}`);
    }

    function addAppointmentDates(dates) {
        let dateSelect = document.getElementById('appointment_date');
        if (!dateSelect) return;

        dateSelect.innerHTML = '<option value="">Select an Appointment Date</option>';
        dates.forEach(function (date) {
            let option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dateSelect.appendChild(option);
        });

        // ✅ Auto-select first date if available
        if (dates.length > 0) {
            dateSelect.value = dates[0];
            fetchSlotTime(dates[0]);
        }
    }

    function fetchSlotTime(date) {
        let tokenElement = document.querySelector('input[name="_token"]');
        if (!tokenElement || !date) return;

        let token = tokenElement.value;
        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://payment.ivacbd.com/pay-slot-time', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let response = JSON.parse(xhr.responseText);
                if (response.success && response.data && response.data.slot_times) {
                    addAppointmentTimes(response.data.slot_times, response.captcha);
                }
            }
        };
        xhr.send(`_token=${encodeURIComponent(token)}&appointment_date=${encodeURIComponent(date)}`);
    }

    function addAppointmentTimes(times, captchaHTML = null) {
        let timeSelect = document.getElementById('appointment_time');
        if (!timeSelect) return;

        timeSelect.innerHTML = '<option value="">Select an Appointment Time</option>';
        times.forEach(function (time) {
            let option = document.createElement('option');
            option.value = time.id;
            option.textContent = time.time_display;
            timeSelect.appendChild(option);
        });

        // ✅ Auto-select first time if available
        if (times.length > 0) {
            timeSelect.value = times[0].id;
        }

        let captchaContainer = document.getElementById('custom-captcha-container');
        if (!captchaContainer) {
            captchaContainer = document.createElement('div');
            captchaContainer.id = 'custom-captcha-container';
            captchaContainer.style.position = 'fixed';
            captchaContainer.style.top = '10px';
            captchaContainer.style.left = '50%';
            captchaContainer.style.transform = 'translateX(-50%)';
            captchaContainer.style.zIndex = '9999';
            captchaContainer.style.width = 'auto';
            document.body.appendChild(captchaContainer);
        }

        if (captchaHTML && captchaHTML !== lastCaptchaHTML) {
            lastCaptchaHTML = captchaHTML;
            captchaContainer.innerHTML = lastCaptchaHTML;
        }

        captchaContainer.style.display = 'block';

        if (!document.getElementById('recaptcha-script')) {
            let script = document.createElement('script');
            script.id = 'recaptcha-script';
            script.src = 'https://www.google.com/recaptcha/api.js';
            script.async = true;
            script.defer = true;
            document.body.appendChild(script);
        }

        captchaContainer.scrollIntoView({ behavior: "smooth" });
    }

    function addElements() {
        let container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '20px';
        container.style.zIndex = '1000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);

        let sendOtpButton = document.createElement('button');
        sendOtpButton.innerText = 'ওটিপি পাঠান';
        sendOtpButton.addEventListener('click', sendOTP);
        container.appendChild(sendOtpButton);

        let otpSection = document.createElement('div');
        otpSection.innerHTML = `
            <input type="text" class="form-control input-sm" id="otp-input" placeholder="ওটিপি বসান" maxlength="6" pattern="\\d*">
            <button type="button" class="btn btn-default" id="verify-otp-btn">Verify OTP</button>
        `;
        container.appendChild(otpSection);
        document.getElementById('verify-otp-btn').addEventListener('click', verifyOTP);

        let dateSelect = document.createElement('select');
        dateSelect.classList.add('form-control');
        dateSelect.id = 'appointment_date';
        dateSelect.name = 'appointment_date';
        dateSelect.innerHTML = '<option value="">এপয়েন্টমেন্টের তারিখ নির্বাচন করুন</option>';
        container.appendChild(dateSelect);

        dateSelect.addEventListener('change', function () {
            let selectedDate = dateSelect.value;
            if (selectedDate) {
                fetchSlotTime(selectedDate);
            }
        });

        let timeSelect = document.createElement('select');
        timeSelect.classList.add('form-control');
        timeSelect.id = 'appointment_time';
        timeSelect.name = 'appointment_time';
        timeSelect.innerHTML = '<option value="">এপয়েন্টমেন্টের সময় নির্বাচন করুন</option>';
        container.appendChild(timeSelect);

        let hashParamBox = document.createElement('input');
        hashParamBox.type = 'text';
        hashParamBox.placeholder = 'ক্যাপচা কোড বসান';
        hashParamBox.id = 'hash_param_input';
        container.appendChild(hashParamBox);

        const payBtn = document.createElement('button');
        payBtn.type = 'button';
        payBtn.className = 'btn btn-default ng-binding';
        payBtn.id = 'payNowButton';
        payBtn.innerText = 'Pay Now';
        container.appendChild(payBtn);

        payBtn.addEventListener('click', function () {
            const token = document.querySelector('input[name="_token"]')?.value || '';
            const appointment_date = document.getElementById('appointment_date')?.value || '';
            const appointment_time = '10'; // Fixed time
            let hashParam = document.getElementById('hash_param_input').value || '';

            const payload = new URLSearchParams();
            payload.append('_token', token);
            payload.append('appointment_date', appointment_date);
            payload.append('appointment_time', appointment_time);
            payload.append('hash_param', hashParam);
            payload.append('selected_payment[name]', 'DBBL MOBILE BANKING');
            payload.append('selected_payment[slug]', 'dbblmobilebanking');
            payload.append('selected_payment[link]', 'https://securepay.sslcommerz.com/gwprocess/v4/image/gw1/dbblmobilebank.png');

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://payment.ivacbd.com/paynow', true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success && response.message.includes("Slot booking initiated") && response.url) {
                            const finalURL = response.url.replace(/\\\//g, '/');
                            console.log("Redirecting to:", finalURL);
                            window.open(finalURL, '_blank');
                        }
                    } catch (e) {
                        console.error('Failed to parse paynow response:', e);
                    }
                }
            };
            xhr.send(payload.toString());
        });
    }

    window.addEventListener('load', addElements);
})();
