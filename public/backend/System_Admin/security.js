// Security Management System
// Handles all security-related functionality for system administrators

import { auth, db } from '../Common/firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    limit,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    addDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// Global variables for security management
let currentTab = 'sessions';
let activeSessions = [];
let systemLogs = [];
let loginHistory = [];
let userAccounts = [];
let securityPolicies = [];

// Initialize security management system
export function initializeSecurity() {
    console.log('🔄 Initializing security management...');
    
    // Set up event listeners
    setupSecurityEventListeners();
    
    // Load initial data
    loadSecurityOverview();
    loadActiveSessions();
    
    console.log('✅ Security management initialized successfully');
}

// Set up event listeners for security management
function setupSecurityEventListeners() {
    // Tab switching
    document.querySelectorAll('.security-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.closest('.security-tab').id.replace('tab-', '');
            showSecurityTab(tabId);
        });
    });
    
    // Log level filter
    const logLevelFilter = document.getElementById('logLevelFilter');
    if (logLevelFilter) {
        logLevelFilter.addEventListener('change', () => {
            filterSystemLogs();
        });
    }
    
    // Account search
    const accountSearch = document.getElementById('accountSearch');
    if (accountSearch) {
        accountSearch.addEventListener('input', () => {
            filterAccounts();
        });
    }
    
    // Role form submission
    const roleForm = document.getElementById('roleForm');
    if (roleForm) {
        roleForm.addEventListener('submit', handleRoleFormSubmit);
    }
    
    // Policy form submission
    const policyForm = document.getElementById('policyForm');
    if (policyForm) {
        policyForm.addEventListener('submit', handlePolicyFormSubmit);
    }
}

// Show security tab content
export function showSecurityTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.security-tab').forEach(tab => {
        tab.classList.remove('active', 'border-[var(--cane-600)]', 'text-[var(--cane-600)]');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.add('active', 'border-[var(--cane-600)]', 'text-[var(--cane-600)]');
        activeTab.classList.remove('border-transparent', 'text-gray-500');
    }
    
    // Update tab content
    document.querySelectorAll('.security-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`content-${tabId}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
    
    currentTab = tabId;
    
    // Load tab-specific data
    switch(tabId) {
        case 'sessions':
            loadActiveSessions();
            break;
        case 'roles':
            loadRolesAndPermissions();
            break;
        case 'logs':
            loadSystemLogs();
            break;
        case 'login-history':
            loadLoginHistory();
            break;
        case 'policies':
            loadSecurityPolicies();
            break;
        case 'accounts':
            loadUserAccounts();
            break;
    }
}

// Load security overview statistics
async function loadSecurityOverview() {
    try {
        // Load active sessions count
        const sessionsQuery = query(
            collection(db, 'user_sessions'),
            where('isActive', '==', true)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        document.getElementById('activeSessionsCount').textContent = sessionsSnapshot.size;
        
        // Load failed logins count (today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const failedLoginsQuery = query(
            collection(db, 'security_logs'),
            where('eventType', '==', 'failed_login'),
            where('timestamp', '>=', today)
        );
        const failedLoginsSnapshot = await getDocs(failedLoginsQuery);
        document.getElementById('failedLoginsCount').textContent = failedLoginsSnapshot.size;
        
        // Load locked accounts count
        const lockedAccountsQuery = query(
            collection(db, 'users'),
            where('isLocked', '==', true)
        );
        const lockedAccountsSnapshot = await getDocs(lockedAccountsQuery);
        document.getElementById('lockedAccountsCount').textContent = lockedAccountsSnapshot.size;
        
        // Load active policies count
        const policiesQuery = query(
            collection(db, 'security_policies'),
            where('isActive', '==', true)
        );
        const policiesSnapshot = await getDocs(policiesQuery);
        document.getElementById('activePoliciesCount').textContent = policiesSnapshot.size;
        
    } catch (error) {
        console.error('❌ Error loading security overview:', error);
    }
}

// Load active user sessions
async function loadActiveSessions() {
    try {
        const sessionsQuery = query(
            collection(db, 'user_sessions'),
            where('isActive', '==', true),
            orderBy('lastActivity', 'desc')
        );
        
        const querySnapshot = await getDocs(sessionsQuery);
        activeSessions = [];
        
        querySnapshot.forEach((doc) => {
            const sessionData = doc.data();
            activeSessions.push({
                id: doc.id,
                ...sessionData,
                lastActivity: sessionData.lastActivity?.toDate() || new Date(),
                loginTime: sessionData.loginTime?.toDate() || new Date()
            });
        });
        
        renderActiveSessions();
        
    } catch (error) {
        console.error('❌ Error loading active sessions:', error);
        showSecurityError('Failed to load active sessions');
    }
}

// Render active sessions table
function renderActiveSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;
    
    if (activeSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-users text-2xl mb-2 text-gray-400"></i>
                        <p>No active sessions</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    activeSessions.forEach(session => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${session.userName || 'Unknown'}</div>
                        <div class="text-sm text-gray-500">${session.userEmail || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getRoleClass(session.userRole)}">
                    ${session.userRole || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${session.ipAddress || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(session.loginTime)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatLastActivity(session.lastActivity)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="terminateSession('${session.id}')" class="text-red-600 hover:text-red-700" title="Terminate Session">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load roles and permissions
async function loadRolesAndPermissions() {
    try {
        // Load roles
        const rolesQuery = query(collection(db, 'roles'), orderBy('name'));
        const rolesSnapshot = await getDocs(rolesQuery);
        
        const rolesList = document.getElementById('rolesList');
        if (rolesList) {
            rolesList.innerHTML = '';
            
            rolesSnapshot.forEach((doc) => {
                const roleData = doc.data();
                const roleDiv = document.createElement('div');
                roleDiv.className = 'p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50';
                roleDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <h5 class="font-medium text-gray-900">${roleData.name}</h5>
                            <p class="text-sm text-gray-500">${roleData.description || 'No description'}</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button onclick="editRole('${doc.id}')" class="text-[var(--cane-600)] hover:text-[var(--cane-700)]">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteRole('${doc.id}')" class="text-red-600 hover:text-red-700">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                rolesList.appendChild(roleDiv);
            });
        }
        
        // Load permissions
        const permissionsQuery = query(collection(db, 'permissions'), orderBy('name'));
        const permissionsSnapshot = await getDocs(permissionsQuery);
        
        const permissionsList = document.getElementById('permissionsList');
        if (permissionsList) {
            permissionsList.innerHTML = '';
            
            permissionsSnapshot.forEach((doc) => {
                const permissionData = doc.data();
                const permissionDiv = document.createElement('div');
                permissionDiv.className = 'p-3 border border-gray-200 rounded-lg';
                permissionDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <h5 class="font-medium text-gray-900">${permissionData.name}</h5>
                            <p class="text-sm text-gray-500">${permissionData.description || 'No description'}</p>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            ${permissionData.category || 'General'}
                        </span>
                    </div>
                `;
                permissionsList.appendChild(permissionDiv);
            });
        }
        
    } catch (error) {
        console.error('❌ Error loading roles and permissions:', error);
    }
}

// Load system logs
async function loadSystemLogs() {
    try {
        const logsQuery = query(
            collection(db, 'security_logs'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        
        const querySnapshot = await getDocs(logsQuery);
        systemLogs = [];
        
        querySnapshot.forEach((doc) => {
            const logData = doc.data();
            systemLogs.push({
                id: doc.id,
                ...logData,
                timestamp: logData.timestamp?.toDate() || new Date()
            });
        });
        
        renderSystemLogs();
        
    } catch (error) {
        console.error('❌ Error loading system logs:', error);
    }
}

// Render system logs
function renderSystemLogs() {
    const logsContainer = document.getElementById('systemLogs');
    if (!logsContainer) return;
    
    if (systemLogs.length === 0) {
        logsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-history text-2xl mb-2"></i>
                <p>No system logs found</p>
            </div>
        `;
        return;
    }
    
    logsContainer.innerHTML = '';
    
    systemLogs.forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = 'flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200';
        
        const levelClass = getLogLevelClass(log.level);
        const iconClass = getLogIcon(log.level);
        
        logDiv.innerHTML = `
            <div class="w-8 h-8 ${levelClass} rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas ${iconClass} text-white text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-medium text-gray-900">${log.message}</p>
                    <span class="text-xs text-gray-500">${formatDateTime(log.timestamp)}</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">${log.details || 'No additional details'}</p>
            </div>
        `;
        
        logsContainer.appendChild(logDiv);
    });
}

// Load login history
async function loadLoginHistory() {
    try {
        const historyQuery = query(
            collection(db, 'login_history'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        
        const querySnapshot = await getDocs(historyQuery);
        loginHistory = [];
        
        querySnapshot.forEach((doc) => {
            const historyData = doc.data();
            loginHistory.push({
                id: doc.id,
                ...historyData,
                timestamp: historyData.timestamp?.toDate() || new Date()
            });
        });
        
        renderLoginHistory();
        
    } catch (error) {
        console.error('❌ Error loading login history:', error);
    }
}

// Render login history table
function renderLoginHistory() {
    const tbody = document.getElementById('loginHistoryTableBody');
    if (!tbody) return;
    
    if (loginHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-sign-in-alt text-2xl mb-2 text-gray-400"></i>
                        <p>No login history found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    loginHistory.forEach(history => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = history.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${history.userName || 'Unknown'}</div>
                <div class="text-sm text-gray-500">${history.userEmail || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getRoleClass(history.userRole)}">
                    ${history.userRole || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(history.timestamp)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${history.ipAddress || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${history.status || 'unknown'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${history.duration || 'N/A'}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load user accounts for management
async function loadUserAccounts() {
    try {
        const accountsQuery = query(
            collection(db, 'users'),
            orderBy('name')
        );
        
        const querySnapshot = await getDocs(accountsQuery);
        userAccounts = [];
        
        querySnapshot.forEach((doc) => {
            const accountData = doc.data();
            userAccounts.push({
                id: doc.id,
                ...accountData,
                lastLogin: accountData.lastLogin?.toDate() || null
            });
        });
        
        renderUserAccounts();
        
    } catch (error) {
        console.error('❌ Error loading user accounts:', error);
    }
}

// Render user accounts table
function renderUserAccounts() {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;
    
    if (userAccounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-users text-2xl mb-2 text-gray-400"></i>
                        <p>No user accounts found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    userAccounts.forEach(account => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = account.isLocked ? 'bg-red-100 text-red-800' : 
                          account.status === 'active' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${account.name || 'Unknown'}</div>
                        <div class="text-sm text-gray-500">${account.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getRoleClass(account.role)}">
                    ${account.role || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${account.isLocked ? 'Locked' : account.status || 'Unknown'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatLastLogin(account.lastLogin)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${account.failedAttempts || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    ${account.isLocked ? 
                        `<button onclick="unlockAccount('${account.id}')" class="text-green-600 hover:text-green-700" title="Unlock Account">
                            <i class="fas fa-unlock"></i>
                        </button>` :
                        `<button onclick="lockAccount('${account.id}')" class="text-red-600 hover:text-red-700" title="Lock Account">
                            <i class="fas fa-lock"></i>
                        </button>`
                    }
                    <button onclick="resetFailedAttempts('${account.id}')" class="text-blue-600 hover:text-blue-700" title="Reset Failed Attempts">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load security policies
async function loadSecurityPolicies() {
    try {
        const policiesQuery = query(
            collection(db, 'security_policies'),
            orderBy('type')
        );
        
        const querySnapshot = await getDocs(policiesQuery);
        securityPolicies = [];
        
        querySnapshot.forEach((doc) => {
            const policyData = doc.data();
            securityPolicies.push({
                id: doc.id,
                ...policyData
            });
        });
        
        renderSecurityPolicies();
        
    } catch (error) {
        console.error('❌ Error loading security policies:', error);
    }
}

// Render security policies
function renderSecurityPolicies() {
    // Update policy values in the UI
    const passwordPolicy = securityPolicies.find(p => p.type === 'password');
    const sessionPolicy = securityPolicies.find(p => p.type === 'session');
    
    if (passwordPolicy) {
        document.getElementById('minPasswordLength').textContent = passwordPolicy.minLength || '8';
        document.getElementById('requireSpecialChars').textContent = passwordPolicy.requireSpecial ? 'Yes' : 'No';
        document.getElementById('passwordExpiry').textContent = passwordPolicy.expiryDays || '90';
    }
    
    if (sessionPolicy) {
        document.getElementById('sessionTimeout').textContent = sessionPolicy.timeoutMinutes || '30';
        document.getElementById('maxFailedAttempts').textContent = sessionPolicy.maxFailedAttempts || '5';
        document.getElementById('lockoutDuration').textContent = sessionPolicy.lockoutDuration || '15';
    }
}

// Utility functions
function getRoleClass(role) {
    switch (role) {
        case 'admin': return 'bg-red-100 text-red-800';
        case 'sra': return 'bg-purple-100 text-purple-800';
        case 'farmer': return 'bg-green-100 text-green-800';
        case 'worker': return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getLogLevelClass(level) {
    switch (level) {
        case 'error': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        case 'info': return 'bg-blue-500';
        case 'critical': return 'bg-red-700';
        default: return 'bg-gray-500';
    }
}

function getLogIcon(level) {
    switch (level) {
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        case 'critical': return 'fa-times-circle';
        default: return 'fa-info-circle';
    }
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
}

function formatLastActivity(date) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    return new Date(date).toLocaleDateString();
}

function formatLastLogin(date) {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(date).toLocaleDateString();
}

// Action functions
export async function terminateSession(sessionId) {
    if (!confirm('Are you sure you want to terminate this session?')) {
        return;
    }
    
    try {
        await updateDoc(doc(db, 'user_sessions', sessionId), {
            isActive: false,
            terminatedAt: serverTimestamp(),
            terminatedBy: 'admin'
        });
        
        showSecurityAlert('Session terminated successfully', 'success');
        loadActiveSessions();
        
    } catch (error) {
        console.error('❌ Error terminating session:', error);
        showSecurityAlert('Failed to terminate session', 'error');
    }
}

export async function lockAccount(userId) {
    if (!confirm('Are you sure you want to lock this account?')) {
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            isLocked: true,
            lockedAt: serverTimestamp(),
            lockedBy: 'admin'
        });
        
        showSecurityAlert('Account locked successfully', 'success');
        loadUserAccounts();
        
    } catch (error) {
        console.error('❌ Error locking account:', error);
        showSecurityAlert('Failed to lock account', 'error');
    }
}

export async function unlockAccount(userId) {
    if (!confirm('Are you sure you want to unlock this account?')) {
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            isLocked: false,
            failedAttempts: 0,
            unlockedAt: serverTimestamp(),
            unlockedBy: 'admin'
        });
        
        showSecurityAlert('Account unlocked successfully', 'success');
        loadUserAccounts();
        
    } catch (error) {
        console.error('❌ Error unlocking account:', error);
        showSecurityAlert('Failed to unlock account', 'error');
    }
}

export async function resetFailedAttempts(userId) {
    if (!confirm('Are you sure you want to reset failed attempts for this account?')) {
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', userId), {
            failedAttempts: 0,
            resetAt: serverTimestamp(),
            resetBy: 'admin'
        });
        
        showSecurityAlert('Failed attempts reset successfully', 'success');
        loadUserAccounts();
        
    } catch (error) {
        console.error('❌ Error resetting failed attempts:', error);
        showSecurityAlert('Failed to reset failed attempts', 'error');
    }
}

// Modal functions
export function openRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) modal.classList.add('hidden');
}

export function openPolicyModal() {
    const modal = document.getElementById('policyModal');
    if (modal) modal.classList.remove('hidden');
}

export function closePolicyModal() {
    const modal = document.getElementById('policyModal');
    if (modal) modal.classList.add('hidden');
}

// Form handlers
async function handleRoleFormSubmit(e) {
    e.preventDefault();
    
    try {
        const roleData = {
            name: document.getElementById('roleName').value,
            description: document.getElementById('roleDescription')?.value || '',
            permissions: Array.from(document.querySelectorAll('#permissionsCheckboxes input:checked')).map(cb => cb.value),
            createdAt: serverTimestamp(),
            createdBy: 'admin'
        };
        
        await addDoc(collection(db, 'roles'), roleData);
        
        showSecurityAlert('Role created successfully', 'success');
        closeRoleModal();
        loadRolesAndPermissions();
        
    } catch (error) {
        console.error('❌ Error creating role:', error);
        showSecurityAlert('Failed to create role', 'error');
    }
}

async function handlePolicyFormSubmit(e) {
    e.preventDefault();
    
    try {
        const policyData = {
            type: document.getElementById('policyType').value,
            value: document.getElementById('policyValue').value,
            description: document.getElementById('policyDescription').value,
            isActive: true,
            createdAt: serverTimestamp(),
            createdBy: 'admin'
        };
        
        await addDoc(collection(db, 'security_policies'), policyData);
        
        showSecurityAlert('Policy created successfully', 'success');
        closePolicyModal();
        loadSecurityPolicies();
        
    } catch (error) {
        console.error('❌ Error creating policy:', error);
        showSecurityAlert('Failed to create policy', 'error');
    }
}

// Refresh functions
export function refreshSessions() {
    loadActiveSessions();
}

export function refreshLogs() {
    loadSystemLogs();
}

export function refreshLoginHistory() {
    loadLoginHistory();
}

export function refreshAccounts() {
    loadUserAccounts();
}

// Filter functions
function filterSystemLogs() {
    const levelFilter = document.getElementById('logLevelFilter')?.value || 'all';
    
    if (levelFilter === 'all') {
        renderSystemLogs();
        return;
    }
    
    const filteredLogs = systemLogs.filter(log => log.level === levelFilter);
    
    const logsContainer = document.getElementById('systemLogs');
    if (!logsContainer) return;
    
    if (filteredLogs.length === 0) {
        logsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-filter text-2xl mb-2"></i>
                <p>No logs found for level: ${levelFilter}</p>
            </div>
        `;
        return;
    }
    
    logsContainer.innerHTML = '';
    
    filteredLogs.forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = 'flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200';
        
        const levelClass = getLogLevelClass(log.level);
        const iconClass = getLogIcon(log.level);
        
        logDiv.innerHTML = `
            <div class="w-8 h-8 ${levelClass} rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas ${iconClass} text-white text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-medium text-gray-900">${log.message}</p>
                    <span class="text-xs text-gray-500">${formatDateTime(log.timestamp)}</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">${log.details || 'No additional details'}</p>
            </div>
        `;
        
        logsContainer.appendChild(logDiv);
    });
}

function filterAccounts() {
    const searchTerm = document.getElementById('accountSearch')?.value?.toLowerCase() || '';
    
    if (!searchTerm) {
        renderUserAccounts();
        return;
    }
    
    const filteredAccounts = userAccounts.filter(account => 
        (account.name && account.name.toLowerCase().includes(searchTerm)) ||
        (account.email && account.email.toLowerCase().includes(searchTerm))
    );
    
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;
    
    if (filteredAccounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-search text-2xl mb-2"></i>
                        <p>No accounts found matching "${searchTerm}"</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    filteredAccounts.forEach(account => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = account.isLocked ? 'bg-red-100 text-red-800' : 
                          account.status === 'active' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${account.name || 'Unknown'}</div>
                        <div class="text-sm text-gray-500">${account.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getRoleClass(account.role)}">
                    ${account.role || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${account.isLocked ? 'Locked' : account.status || 'Unknown'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatLastLogin(account.lastLogin)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${account.failedAttempts || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    ${account.isLocked ? 
                        `<button onclick="unlockAccount('${account.id}')" class="text-green-600 hover:text-green-700" title="Unlock Account">
                            <i class="fas fa-unlock"></i>
                        </button>` :
                        `<button onclick="lockAccount('${account.id}')" class="text-red-600 hover:text-red-700" title="Lock Account">
                            <i class="fas fa-lock"></i>
                        </button>`
                    }
                    <button onclick="resetFailedAttempts('${account.id}')" class="text-blue-600 hover:text-blue-700" title="Reset Failed Attempts">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Show security alert
function showSecurityAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 right-4 z-50 max-w-md';
    
    const bgColor = type === 'success' ? 'bg-green-500' : 
                   type === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle';
    
    alertDiv.innerHTML = `
        <div class="${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3">
            <i class="fas ${icon}"></i>
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

// Show security error
function showSecurityError(message) {
    const tbody = document.getElementById('sessionsTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Export functions for global access
window.initializeSecurity = initializeSecurity;
window.showSecurityTab = showSecurityTab;
window.terminateSession = terminateSession;
window.lockAccount = lockAccount;
window.unlockAccount = unlockAccount;
window.resetFailedAttempts = resetFailedAttempts;
window.openRoleModal = openRoleModal;
window.closeRoleModal = closeRoleModal;
window.openPolicyModal = openPolicyModal;
window.closePolicyModal = closePolicyModal;
window.refreshSessions = refreshSessions;
window.refreshLogs = refreshLogs;
window.refreshLoginHistory = refreshLoginHistory;
window.refreshAccounts = refreshAccounts;
