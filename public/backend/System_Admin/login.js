

// Import Firebase configuration and auth/db instances
import { auth, db } from '../Common/firebase-config.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    limit,
    serverTimestamp,
    doc,
    updateDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// Security Configuration
const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 3,
    LOCKOUT_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
    ADMIN_ROLES: ['super_admin', 'system_admin', 'security_admin'],
    REQUIRED_PERMISSIONS: ['admin_access', 'system_management', 'user_management']
};

// Global Variables
let loginAttempts = 0;
let isLockedOut = false;
let lockoutEndTime = null;
let currentSession = null;
let sessionTimeout = null;
let currentFailedAttempts = 0;

// Client-side failed attempts tracking (fallback when Firebase is not accessible)
let clientSideFailedAttempts = {};
let clientSideLockouts = {};

// Client-side security functions (fallback when Firebase is not accessible)
class ClientSideSecurity {
    static getFailedAttempts(pinCode) {
        const attempts = clientSideFailedAttempts[pinCode] || 0;
        console.log(`Client-side failed attempts for PIN ${pinCode}: ${attempts}`);
        return attempts;
    }
    
    static incrementFailedAttempts(pinCode) {
        if (!clientSideFailedAttempts[pinCode]) {
            clientSideFailedAttempts[pinCode] = 0;
        }
        clientSideFailedAttempts[pinCode]++;
        console.log(`Client-side failed attempts incremented for PIN ${pinCode}: ${clientSideFailedAttempts[pinCode]}`);
        console.log(`All client-side attempts:`, clientSideFailedAttempts);
        return clientSideFailedAttempts[pinCode];
    }
    
    static resetFailedAttempts(pinCode) {
        clientSideFailedAttempts[pinCode] = 0;
    }
    
    static isLocked(pinCode) {
        const lockout = clientSideLockouts[pinCode];
        if (!lockout) return false;
        
        const now = Date.now();
        if (now - lockout.timestamp > SECURITY_CONFIG.LOCKOUT_DURATION) {
            // Lockout expired
            delete clientSideLockouts[pinCode];
            this.resetFailedAttempts(pinCode);
            return false;
        }
        return true;
    }
    
    static setLockout(pinCode) {
        clientSideLockouts[pinCode] = {
            timestamp: Date.now()
        };
    }
    
    static getRemainingLockoutTime(pinCode) {
        const lockout = clientSideLockouts[pinCode];
        if (!lockout) return 0;
        
        const elapsed = Date.now() - lockout.timestamp;
        const remaining = SECURITY_CONFIG.LOCKOUT_DURATION - elapsed;
        return Math.max(0, remaining);
    }
}

// Utility Functions
class SecurityLogger {
    static async logEvent(eventType, details) {
        try {
            const logEntry = {
                timestamp: serverTimestamp(),
                eventType: eventType,
                details: details,
                userAgent: navigator.userAgent,
                ipAddress: await this.getClientIP(),
                sessionId: currentSession?.id || 'anonymous'
            };
            
            await addDoc(collection(db, 'admin_security_logs'), logEntry);
            console.log(`Security Event Logged: ${eventType}`, details);
        } catch (error) {
            console.error('Failed to log security event:', error);
            // Fallback: log to console if Firebase fails
            console.log('Security Event (Fallback):', eventType, details);
        }
    }
    
    static async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }
    
    static async checkFailedAttempts(pinCode) {
        try {
            // Try Firebase first
            const q = query(
                collection(db, 'admin_security_logs'),
                where('details.pinCode', '==', pinCode),
                where('eventType', '==', 'failed_login'),
                orderBy('timestamp', 'desc'),
                limit(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS)
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.size;
        } catch (error) {
            console.error('Firebase query failed, using client-side tracking:', error);
            // Fallback to client-side tracking
            return ClientSideSecurity.getFailedAttempts(pinCode);
        }
    }
    
    static async getRecentFailedAttempts(pinCode) {
        try {
            const q = query(
                collection(db, 'admin_security_logs'),
                where('details.pinCode', '==', pinCode),
                where('eventType', '==', 'failed_login'),
                orderBy('timestamp', 'desc'),
                limit(SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS)
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error('Error getting recent failed attempts:', error);
            return [];
        }
    }
    
    static async isAccountLocked(pinCode) {
        try {
            // Try Firebase first
            const q = query(
                collection(db, 'admin_security_logs'),
                where('details.pinCode', '==', pinCode),
                where('eventType', '==', 'account_locked'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return false;
            
            const lockEntry = querySnapshot.docs[0].data();
            const lockTime = lockEntry.timestamp.toDate();
            const now = new Date();
            
            return (now - lockTime) < SECURITY_CONFIG.LOCKOUT_DURATION;
        } catch (error) {
            console.error('Firebase lock check failed, using client-side tracking:', error);
            // Fallback to client-side tracking
            return ClientSideSecurity.isLocked(pinCode);
        }
    }
}

class SessionManager {
    static createSession(user) {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        currentSession = {
            id: sessionId,
            userId: user.uid,
            email: user.email,
            startTime: new Date(),
            lastActivity: new Date(),
            isActive: true
        };
        
        // Store session in localStorage
        localStorage.setItem('admin_session', JSON.stringify(currentSession));
        
        // Set session timeout
        this.resetSessionTimeout();
        
        return currentSession;
    }
    
    static resetSessionTimeout() {
        if (sessionTimeout) {
            clearTimeout(sessionTimeout);
        }
        
        sessionTimeout = setTimeout(() => {
            this.endSession('timeout');
        }, SECURITY_CONFIG.SESSION_TIMEOUT);
    }
    
    static updateActivity() {
        if (currentSession) {
            currentSession.lastActivity = new Date();
            localStorage.setItem('admin_session', JSON.stringify(currentSession));
            this.resetSessionTimeout();
        }
    }
    
    static async endSession(reason = 'logout') {
        if (currentSession) {
            await SecurityLogger.logEvent('session_ended', {
                sessionId: currentSession.id,
                reason: reason,
                duration: new Date() - currentSession.startTime
            });
            
            currentSession = null;
            localStorage.removeItem('admin_session');
        }
        
        if (sessionTimeout) {
            clearTimeout(sessionTimeout);
            sessionTimeout = null;
        }
    }
    
    static loadSession() {
        try {
            const sessionData = localStorage.getItem('admin_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                const now = new Date();
                const sessionAge = now - new Date(session.startTime);
                
                if (sessionAge < SECURITY_CONFIG.SESSION_TIMEOUT) {
                    currentSession = session;
                    this.resetSessionTimeout();
                    return true;
                } else {
                    localStorage.removeItem('admin_session');
                }
            }
        } catch (error) {
            console.error('Error loading session:', error);
            localStorage.removeItem('admin_session');
        }
        return false;
    }
}

class AdminAuth {
    static async authenticateAdmin(pinCode) {
        try {
            // Check if account is locked
            const isLocked = await SecurityLogger.isAccountLocked(pinCode);
            if (isLocked) {
                const lockoutTime = Math.ceil(SECURITY_CONFIG.LOCKOUT_DURATION / 60000); // Convert to minutes
                await SecurityLogger.logEvent('login_attempt_blocked', {
                    pinCode: pinCode,
                    reason: 'account_locked'
                });
                throw new Error(`Account is temporarily locked due to ${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS} failed attempts. Please wait ${lockoutTime} minutes before trying again.`);
            }
            
            // Check failed attempts
            const failedAttempts = await SecurityLogger.checkFailedAttempts(pinCode);
            // Use client-side tracking for consistency
            const clientSideAttempts = ClientSideSecurity.getFailedAttempts(pinCode);
            currentFailedAttempts = Math.max(failedAttempts, clientSideAttempts);
            
            if (failedAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
                await SecurityLogger.logEvent('account_locked', {
                    pinCode: pinCode,
                    failedAttempts: failedAttempts
                });
                const lockoutTime = Math.ceil(SECURITY_CONFIG.LOCKOUT_DURATION / 60000);
                throw new Error(`Account locked due to ${failedAttempts} failed attempts. Please wait ${lockoutTime} minutes before trying again.`);
            }
            
            // Validate PIN code
            if (!pinCode || pinCode.length !== 6 || !/^\d{6}$/.test(pinCode)) {
                await SecurityLogger.logEvent('failed_login', {
                    pinCode: pinCode,
                    reason: 'invalid_pin_format'
                });
                throw new Error('Please enter a valid 6-digit PIN code');
            }
            
            // Get admin credentials by PIN
            const adminCredentials = await this.getAdminCredentials(pinCode);
            if (!adminCredentials) {
                console.log(`=== INVALID PIN for ${pinCode} ===`);
                // Increment client-side tracking first
                const newFailedAttempts = ClientSideSecurity.incrementFailedAttempts(pinCode);
                currentFailedAttempts = newFailedAttempts;
                console.log(`New failed attempts: ${newFailedAttempts}`);
                console.log(`Current failed attempts set to: ${currentFailedAttempts}`);
                
                // Try to log to Firebase, but don't fail if it doesn't work
                try {
                await SecurityLogger.logEvent('failed_login', {
                    pinCode: pinCode,
                        reason: 'invalid_pin',
                        attemptNumber: newFailedAttempts,
                        totalFailedAttempts: newFailedAttempts
                    });
                } catch (logError) {
                    // Firebase logging failed, continue with client-side tracking
                }
                
                const remainingAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - newFailedAttempts;
                
                if (newFailedAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
                    // Set client-side lockout only after exactly 3 attempts
                    ClientSideSecurity.setLockout(pinCode);
                    const lockoutTime = Math.ceil(SECURITY_CONFIG.LOCKOUT_DURATION / 60000);
                    throw new Error(`Account locked due to ${newFailedAttempts} failed attempts. Please wait ${lockoutTime} minutes before trying again.`);
                } else {
                    // Show remaining attempts for attempts 1 and 2
                    throw new Error(`Invalid PIN code. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`);
                }
            }
            
            // Successful authentication - reset failed attempts
            currentFailedAttempts = 0;
            ClientSideSecurity.resetFailedAttempts(pinCode);
            
            try {
            await SecurityLogger.logEvent('successful_login', {
                pinCode: pinCode,
                role: adminCredentials.role,
                permissions: adminCredentials.permissions,
                adminName: adminCredentials.name
            });
            } catch (logError) {
                // Firebase logging failed for successful login
            }
            
            return {
                success: true,
                user: {
                    uid: adminCredentials.uid,
                    email: adminCredentials.email,
                    name: adminCredentials.name,
                    role: adminCredentials.role,
                    permissions: adminCredentials.permissions
                }
            };
            
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }
    
    static async getAdminCredentials(pinCode) {
        // Try Firestore-based PINs first (this takes priority)
        try {
            const qPins = query(
                collection(db, 'admin_pins'),
                where('pin', '==', pinCode),
                limit(1)
            );
            const snap = await getDocs(qPins);
            if (!snap.empty) {
                const d = snap.docs[0].data();
                return {
                    uid: d.uid || ('admin_' + snap.docs[0].id),
                    email: d.email || 'admin@canemap.com',
                    pin: d.pin,
                    role: d.role || 'super_admin',
                    permissions: Array.isArray(d.permissions) ? d.permissions : ['admin_access', 'system_management', 'user_management', 'security_management'],
                    name: d.name || 'System Administrator'
                };
            }
        } catch (err) {
            console.error('Error reading admin_pins:', err);
        }

        // Fallback: Only allow the default PIN 123456 for initial access
        // This is only used if no PIN exists in Firestore yet
        if (pinCode === '123456') {
            return {
                uid: 'admin_001',
                email: 'admin@canemap.com',
                pin: '123456',
                role: 'super_admin',
                permissions: ['admin_access', 'system_management', 'user_management', 'security_management'],
                name: 'System Administrator'
            };
        }
        
        return null;
    }

    static async ensureDefaultAdminPin() {
        try {
            // Only seed default PIN 123456 if NO admin PINs exist at all
            const qAllPins = query(collection(db, 'admin_pins'), limit(1));
            const snapAll = await getDocs(qAllPins);
            
            if (snapAll.empty) {
                // No admin PINs exist, create the default one
                const defaultPin = '123456';
                await addDoc(collection(db, 'admin_pins'), {
                    pin: defaultPin,
                    name: 'System Administrator',
                    email: 'admin@canemap.com',
                    role: 'super_admin',
                    permissions: ['admin_access', 'system_management', 'user_management', 'security_management'],
                    createdAt: serverTimestamp(),
                    active: true
                });
                await SecurityLogger.logEvent('seed_admin_pin_created', { pin: defaultPin });
                console.log('Default admin PIN 123456 created in Firestore');
            }
        } catch (e) {
            console.error('Failed to seed default admin PIN', e);
        }
    }
    
    static async logout() {
        try {
            await SessionManager.endSession('manual_logout');
            await SecurityLogger.logEvent('logout', {
                sessionId: currentSession?.id
            });
            
            // Clear any cached data
            localStorage.removeItem('admin_session');
            sessionStorage.clear();
            
            // Redirect to login page
            window.location.href = '../System_Admin/login.html';
            
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

// UI Management
class LoginUI {
    static showLoading() {
        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        const loginSpinner = document.getElementById('loginSpinner');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        loginBtn.disabled = true;
        loginBtnText.classList.add('hidden');
        loginSpinner.classList.remove('hidden');
        loadingOverlay.classList.remove('hidden');
    }
    
    static hideLoading() {
        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        const loginSpinner = document.getElementById('loginSpinner');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        loginBtn.disabled = false;
        loginBtnText.classList.remove('hidden');
        loginSpinner.classList.add('hidden');
        loadingOverlay.classList.add('hidden');
    }
    
    static showError(message, isLockout = false) {
        const form = document.getElementById('adminLoginForm');
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
        
        // Show different alert types based on error
        const alertType = isLockout ? 'warning' : 'error';
        showAlert(message, alertType);
    }
    
    static updateAttemptDisplay() {
        const remainingAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - currentFailedAttempts;
        const attemptDisplay = document.getElementById('attemptDisplay');
        
        console.log(`=== UPDATE ATTEMPT DISPLAY ===`);
        console.log(`currentFailedAttempts: ${currentFailedAttempts}`);
        console.log(`remainingAttempts: ${remainingAttempts}`);
        console.log(`MAX_LOGIN_ATTEMPTS: ${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}`);
        
        if (attemptDisplay) {
            if (currentFailedAttempts > 0) {
                const displayText = `${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining`;
                console.log(`Display text: ${displayText}`);
                attemptDisplay.innerHTML = `
                    <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mt-3">
                        <div class="flex items-center space-x-2">
                            <i class="fas fa-exclamation-triangle text-red-400"></i>
                            <div class="text-xs text-red-200">
                                <p class="font-semibold mb-1">Failed Attempts: ${currentFailedAttempts}/${SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}</p>
                                <p>${remainingAttempts > 0 ? displayText : 'Account will be locked'}</p>
                            </div>
                        </div>
                    </div>
                `;
                attemptDisplay.classList.remove('hidden');
                console.log('Attempt display shown with:', displayText);
            } else {
                attemptDisplay.classList.add('hidden');
                console.log('Attempt display hidden');
            }
        } else {
            console.log('Attempt display element not found');
        }
    }
    
    static async updateAttemptDisplayForPin(pinCode) {
        try {
            // Use client-side tracking for immediate updates
            const failedAttempts = ClientSideSecurity.getFailedAttempts(pinCode);
            currentFailedAttempts = failedAttempts;
            this.updateAttemptDisplay();
        } catch (error) {
            console.error('Error updating attempt display:', error);
        }
    }
    
    static showLockoutMessage() {
        const lockoutTime = Math.ceil(SECURITY_CONFIG.LOCKOUT_DURATION / 60000);
        const lockoutDisplay = document.getElementById('lockoutDisplay');
        
        if (lockoutDisplay) {
            lockoutDisplay.innerHTML = `
                <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mt-3">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-lock text-red-400 text-lg"></i>
                        <div class="text-sm text-red-200">
                            <p class="font-semibold mb-1">Account Temporarily Locked</p>
                            <p>Too many failed attempts. Please wait ${lockoutTime} minutes before trying again.</p>
                            <div class="mt-2">
                                <div class="bg-red-500/30 rounded-full h-2">
                                    <div id="lockoutProgress" class="bg-red-400 h-2 rounded-full transition-all duration-1000" style="width: 100%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            lockoutDisplay.classList.remove('hidden');
            
            // Start countdown timer
            this.startLockoutCountdown();
        }
    }
    
    static showClientSideLockoutMessage(pinCode) {
        const lockoutDisplay = document.getElementById('lockoutDisplay');
        
        if (lockoutDisplay) {
            lockoutDisplay.innerHTML = `
                <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mt-3">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-lock text-red-400 text-lg"></i>
                        <div class="text-sm text-red-200">
                            <p class="font-semibold mb-1">Account Temporarily Locked</p>
                            <p>Too many failed attempts. Please wait before trying again.</p>
                            <div class="mt-2">
                                <div class="bg-red-500/30 rounded-full h-2">
                                    <div id="lockoutProgress" class="bg-red-400 h-2 rounded-full transition-all duration-1000" style="width: 100%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            lockoutDisplay.classList.remove('hidden');
            
            // Start client-side countdown timer
            this.startClientSideLockoutCountdown(pinCode);
        }
    }
    
    static startClientSideLockoutCountdown(pinCode) {
        const lockoutProgress = document.getElementById('lockoutProgress');
        const totalTime = SECURITY_CONFIG.LOCKOUT_DURATION;
        
        const countdown = setInterval(() => {
            const remainingTime = ClientSideSecurity.getRemainingLockoutTime(pinCode);
            const progress = (remainingTime / totalTime) * 100;
            
            if (lockoutProgress) {
                lockoutProgress.style.width = `${progress}%`;
            }
            
            if (remainingTime <= 0) {
                clearInterval(countdown);
                const lockoutDisplay = document.getElementById('lockoutDisplay');
                if (lockoutDisplay) {
                    lockoutDisplay.classList.add('hidden');
                }
                currentFailedAttempts = 0;
                this.updateAttemptDisplay();
            }
        }, 1000);
    }
    
    static startLockoutCountdown() {
        const lockoutProgress = document.getElementById('lockoutProgress');
        const totalTime = SECURITY_CONFIG.LOCKOUT_DURATION;
        let remainingTime = totalTime;
        
        const countdown = setInterval(() => {
            remainingTime -= 1000;
            const progress = (remainingTime / totalTime) * 100;
            
            if (lockoutProgress) {
                lockoutProgress.style.width = `${progress}%`;
            }
            
            if (remainingTime <= 0) {
                clearInterval(countdown);
                const lockoutDisplay = document.getElementById('lockoutDisplay');
                if (lockoutDisplay) {
                    lockoutDisplay.classList.add('hidden');
                }
                currentFailedAttempts = 0;
                this.updateAttemptDisplay();
            }
        }, 1000);
    }
    
    static showSuccess(message) {
        showAlert(message, 'success');
    }
    
    static clearForm() {
        document.getElementById('adminLoginForm').reset();
        document.getElementById('pinCode').focus();
    }
    
    static updateSecurityStatus(status) {
        const statusElement = document.querySelector('.text-green-400');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
}

// Main Login Handler
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const pinCode = formData.get('pinCode').trim();
    
    // Validate input
    if (!pinCode || pinCode.length !== 6) {
        LoginUI.showError('Please enter a valid 6-digit PIN code');
        return;
    }
    
    LoginUI.showLoading();
    LoginUI.updateSecurityStatus('Authenticating...');
    
    try {
        // Authenticate admin
        const authResult = await AdminAuth.authenticateAdmin(pinCode);
        
        if (authResult.success) {
            // Create session
            const session = SessionManager.createSession(authResult.user);
            
            // Log successful login
            await SecurityLogger.logEvent('admin_session_started', {
                pinCode: pinCode,
                role: authResult.user.role,
                sessionId: session.id,
                adminName: authResult.user.name
            });
            
            LoginUI.showSuccess('Authentication successful! Redirecting...');
            LoginUI.updateSecurityStatus('Authenticated');
            
            // Store user data
            sessionStorage.setItem('admin_user', JSON.stringify(authResult.user));
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
            
        } else {
            throw new Error('Authentication failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Check if it's a lockout error
        const isLockoutError = error.message.includes('locked') || error.message.includes('wait');
        
        if (isLockoutError) {
            // Only show lockout if we actually have 3 failed attempts
            const currentAttempts = ClientSideSecurity.getFailedAttempts(pinCode);
            if (currentAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
                // Check if it's a client-side lockout
                if (ClientSideSecurity.isLocked(pinCode)) {
                    LoginUI.showClientSideLockoutMessage(pinCode);
                } else {
                    LoginUI.showLockoutMessage();
                }
            } else {
                // Still have attempts remaining, show error instead
                LoginUI.showError(error.message || 'Authentication failed. Please try again.');
                currentFailedAttempts = currentAttempts;
                LoginUI.updateAttemptDisplay();
            }
        } else {
            console.log(`=== ERROR HANDLING for PIN ${pinCode} ===`);
            console.log(`Error message: ${error.message}`);
        LoginUI.showError(error.message || 'Authentication failed. Please try again.');
            // Update attempt display immediately with current count
            const currentAttempts = ClientSideSecurity.getFailedAttempts(pinCode);
            currentFailedAttempts = currentAttempts;
            console.log(`Setting currentFailedAttempts to: ${currentAttempts}`);
            console.log(`All client-side data:`, clientSideFailedAttempts);
            LoginUI.updateAttemptDisplay();
        }
        
        LoginUI.updateSecurityStatus('Authentication Failed');
        
        // Clear form on error (but not for lockout)
        const finalAttempts = ClientSideSecurity.getFailedAttempts(pinCode);
        const isActuallyLocked = finalAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;
        
        if (!isActuallyLocked) {
        setTimeout(() => {
            LoginUI.clearForm();
        }, 2000);
        }
        
    } finally {
        LoginUI.hideLoading();
    }
}

// Session Management
function initializeSession() {
    // Load existing session
    if (SessionManager.loadSession()) {
        // Check if user is already logged in
        const adminUser = sessionStorage.getItem('admin_user');
        if (adminUser) {
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
            return;
        }
    }
    
    // Set up activity tracking
    document.addEventListener('click', SessionManager.updateActivity);
    document.addEventListener('keypress', SessionManager.updateActivity);
    document.addEventListener('scroll', SessionManager.updateActivity);
}

// Security Monitoring
function initializeSecurityMonitoring() {
    // Monitor for suspicious activity
    let activityCount = 0;
    const activityThreshold = 100; // Rapid clicks/keystrokes
    
    document.addEventListener('click', () => {
        activityCount++;
        if (activityCount > activityThreshold) {
            SecurityLogger.logEvent('suspicious_activity', {
                type: 'rapid_activity',
                count: activityCount
            });
        }
    });
    
    // Reset activity count every minute
    setInterval(() => {
        activityCount = 0;
    }, 60000);
    
    // Monitor for multiple tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'admin_session' && e.newValue) {
            SecurityLogger.logEvent('multiple_tabs_detected', {
                sessionId: currentSession?.id
            });
        }
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize session management
    initializeSession();
    
    // Initialize security monitoring
    initializeSecurityMonitoring();
    
    // Set up form submission
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Set up keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Shift+L for logout (if logged in)
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            AdminAuth.logout();
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            LoginUI.clearForm();
        }
    });
    
    // Check for existing failed attempts on page load
    checkExistingFailedAttempts();
    
    // Log page access
    SecurityLogger.logEvent('admin_login_page_accessed', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    });
    
    console.log('System Admin Login initialized');
    // Ensure default admin PIN exists in Firestore
    AdminAuth.ensureDefaultAdminPin();
});

// Check for existing failed attempts
async function checkExistingFailedAttempts() {
    try {
        // Check if there are any recent failed attempts for any PIN
        const q = query(
            collection(db, 'admin_security_logs'),
            where('eventType', '==', 'failed_login'),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const recentAttempts = querySnapshot.docs.map(doc => doc.data());
            const pinAttempts = {};
            
            // Group attempts by PIN
            recentAttempts.forEach(attempt => {
                const pin = attempt.details?.pinCode;
                if (pin) {
                    if (!pinAttempts[pin]) {
                        pinAttempts[pin] = 0;
                    }
                    pinAttempts[pin]++;
                }
            });
            
            // Check if any PIN has reached the limit
            for (const [pin, count] of Object.entries(pinAttempts)) {
                if (count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
                    const isLocked = await SecurityLogger.isAccountLocked(pin);
                    if (isLocked) {
                        currentFailedAttempts = count;
                        LoginUI.showLockoutMessage();
                        break;
                    }
                } else if (count > 0) {
                    // Show attempt counter for PINs with failed attempts but not locked
                    currentFailedAttempts = count;
                    LoginUI.updateAttemptDisplay();
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Firebase check failed, using client-side tracking:', error);
        // Fallback to client-side tracking
        for (const [pin, count] of Object.entries(clientSideFailedAttempts)) {
            if (count > 0) {
                currentFailedAttempts = count;
                if (count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS && ClientSideSecurity.isLocked(pin)) {
                    LoginUI.showClientSideLockoutMessage(pin);
                } else {
                    LoginUI.updateAttemptDisplay();
                }
                break;
            }
        }
    }
}

// Export functions for global access
window.AdminAuth = AdminAuth;
window.SecurityLogger = SecurityLogger;
window.SessionManager = SessionManager;

