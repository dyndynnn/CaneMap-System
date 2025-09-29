// System Admin Dashboard Management
// Handles user management, activity logging, and system administration

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
    getDoc,
    deleteDoc,
    onSnapshot,
    setDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// Global variables
let currentUser = null;
let users = [];
let activityLogs = [];
let currentPage = 1;
let itemsPerPage = 10;
let filteredUsers = [];

// Initialize dashboard
async function initializeDashboard() {
    try {
        console.log('🔄 Initializing dashboard...');
        
        // Check if user is logged in
        const adminUser = sessionStorage.getItem('admin_user');
        if (!adminUser) {
            console.log('⚠️ No admin user found, using default values');
            // Set default admin name
            const adminNameEl = document.getElementById('adminName');
            const dropdownAdminNameEl = document.getElementById('dropdownAdminName');
            const sidebarAdminNameEl = document.getElementById('sidebarAdminName');
            
            if (adminNameEl) adminNameEl.textContent = 'System Admin';
            if (dropdownAdminNameEl) dropdownAdminNameEl.textContent = 'System Admin';
            if (sidebarAdminNameEl) sidebarAdminNameEl.textContent = 'System Admin';
        } else {
            currentUser = JSON.parse(adminUser);
            
            // Update admin name in header and sidebar
            const adminNameEl = document.getElementById('adminName');
            const dropdownAdminNameEl = document.getElementById('dropdownAdminName');
            const sidebarAdminNameEl = document.getElementById('sidebarAdminName');
            
            if (adminNameEl) adminNameEl.textContent = currentUser.name;
            if (dropdownAdminNameEl) dropdownAdminNameEl.textContent = currentUser.name;
            if (sidebarAdminNameEl) sidebarAdminNameEl.textContent = currentUser.name;
        }
        
        // Load dashboard data
        await loadDashboardStats();
        await loadUsers();
        await loadActivityLogs();
        
        // Set up real-time listeners
        setupRealtimeListeners();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('✅ Dashboard initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        // Don't show alert on initialization error, just log it
        console.log('⚠️ Dashboard initialization failed, but continuing...');
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        console.log('🔄 Loading dashboard stats...');
        
        // Get total users
        let totalUsers = 0;
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            totalUsers = usersSnapshot.size;
            console.log(`📊 Total users: ${totalUsers}`);
        } catch (error) {
            console.log('⚠️ Could not load users collection:', error.message);
        }
        
        // Get active users (logged in within last 30 days)
        let activeUsers = 0;
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const activeUsersQuery = query(
                collection(db, 'users'),
                where('lastLogin', '>=', thirtyDaysAgo)
            );
            const activeUsersSnapshot = await getDocs(activeUsersQuery);
            activeUsers = activeUsersSnapshot.size;
            console.log(`📊 Active users: ${activeUsers}`);
        } catch (error) {
            console.log('⚠️ Could not load active users:', error.message);
        }
        
        // Get failed logins today
        let failedLogins = 0;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const failedLoginsQuery = query(
                collection(db, 'admin_security_logs'),
                where('eventType', '==', 'failed_login'),
                where('timestamp', '>=', today)
            );
            const failedLoginsSnapshot = await getDocs(failedLoginsQuery);
            failedLogins = failedLoginsSnapshot.size;
            console.log(`📊 Failed logins: ${failedLogins}`);
        } catch (error) {
            console.log('⚠️ Could not load failed logins:', error.message);
        }
        
        // Get driver badges
        let driverBadges = 0;
        try {
            const driverBadgesQuery = query(
                collection(db, 'users'),
                where('driverBadge', '==', 'approved')
            );
            const driverBadgesSnapshot = await getDocs(driverBadgesQuery);
            driverBadges = driverBadgesSnapshot.size;
            console.log(`📊 Driver badges: ${driverBadges}`);
        } catch (error) {
            console.log('⚠️ Could not load driver badges:', error.message);
        }
        
        // Update UI
        const totalUsersEl = document.getElementById('totalUsers');
        const activeUsersEl = document.getElementById('activeUsers');
        const failedLoginsEl = document.getElementById('failedLogins');
        const driverBadgesEl = document.getElementById('driverBadges');
        
        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
        if (activeUsersEl) activeUsersEl.textContent = activeUsers;
        if (failedLoginsEl) failedLoginsEl.textContent = failedLogins;
        if (driverBadgesEl) driverBadgesEl.textContent = driverBadges;
        
        console.log('✅ Dashboard stats loaded successfully');
        
        // Load analytics charts
        await loadAnalyticsCharts();
        
    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
        // Set default values if loading fails
        const totalUsersEl = document.getElementById('totalUsers');
        const activeUsersEl = document.getElementById('activeUsers');
        const failedLoginsEl = document.getElementById('failedLogins');
        const driverBadgesEl = document.getElementById('driverBadges');
        
        if (totalUsersEl) totalUsersEl.textContent = '0';
        if (activeUsersEl) activeUsersEl.textContent = '0';
        if (failedLoginsEl) failedLoginsEl.textContent = '0';
        if (driverBadgesEl) driverBadgesEl.textContent = '0';
    }
}

// Load users from Firebase
async function loadUsers() {
    try {
        console.log('🔄 Loading users...');
        
        const usersQuery = query(
            collection(db, 'users'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(usersQuery);
        users = [];
        
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            users.push({
                id: doc.id,
                ...userData,
                createdAt: userData.createdAt?.toDate() || new Date(),
                lastLogin: userData.lastLogin?.toDate() || null
            });
        });
        
        filteredUsers = [...users];
        console.log(`📊 Loaded ${users.length} users`);
        
        // Only render table if the users table exists
        const usersTableBody = document.getElementById('usersTableBody');
        if (usersTableBody) {
            renderUsersTable();
        }
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        // Don't show alert if we're not on the users page
        const usersTableBody = document.getElementById('usersTableBody');
        if (usersTableBody) {
            showAlert('Failed to load users', 'error');
        }
    }
}

// Render users table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (pageUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-users text-4xl mb-4"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    pageUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = getStatusClass(user.status);
        const roleClass = getRoleClass(user.role);
        const badgeClass = getBadgeClass(user.driverBadge);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-white text-sm"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${user.name || 'N/A'}</div>
                        <div class="text-sm text-gray-500">${user.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${roleClass}">
                    ${user.role || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${user.status || 'inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}">
                    ${user.driverBadge === 'approved' ? 'Badge Holder' : 
                      user.driverBadge === 'pending' ? 'Pending' : 'No Badge'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="editUser('${user.id}')" class="text-[var(--cane-600)] hover:text-[var(--cane-700)]">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePagination();
}

// Load activity logs
async function loadActivityLogs() {
    try {
        console.log('🔄 Loading activity logs...');
        
        const activityQuery = query(
            collection(db, 'admin_security_logs'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(activityQuery);
        activityLogs = [];
        
        querySnapshot.forEach((doc) => {
            const logData = doc.data();
            activityLogs.push({
                id: doc.id,
                ...logData,
                timestamp: logData.timestamp?.toDate() || new Date()
            });
        });
        
        console.log(`📊 Loaded ${activityLogs.length} activity logs`);
        
        // Only render if the activity log container exists
        const activityLogContainer = document.getElementById('activityLog');
        if (activityLogContainer) {
            renderActivityLogs();
        }
        
    } catch (error) {
        console.error('❌ Error loading activity logs:', error);
        // Don't show error if we're not on the activity log page
    }
}

// Render activity logs
function renderActivityLogs() {
    const container = document.getElementById('activityLog');
    container.innerHTML = '';
    
    if (activityLogs.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-history text-2xl mb-2"></i>
                <p>No activity logs</p>
            </div>
        `;
        return;
    }
    
    activityLogs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'flex items-start space-x-3 p-3 bg-gray-50 rounded-lg';
        
        const iconClass = getActivityIcon(log.eventType);
        const colorClass = getActivityColor(log.eventType);
        
        logItem.innerHTML = `
            <div class="w-8 h-8 ${colorClass} rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas ${iconClass} text-white text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">${getActivityMessage(log)}</p>
                <p class="text-xs text-gray-500">${formatDate(log.timestamp)}</p>
            </div>
        `;
        
        container.appendChild(logItem);
    });
}

// Set up real-time listeners
function setupRealtimeListeners() {
    // Listen for new users
    const usersListener = onSnapshot(collection(db, 'users'), (snapshot) => {
        loadUsers();
        loadDashboardStats();
    });
    
    // Listen for new activity logs
    const activityListener = onSnapshot(
        query(collection(db, 'security_logs'), orderBy('timestamp', 'desc'), limit(20)),
        (snapshot) => {
            loadActivityLogs();
            loadDashboardStats();
        }
    );
}

// Set up event listeners
function setupEventListeners() {
    // Profile dropdown
    const profileBtn = document.getElementById('adminProfileBtn');
    const profileDropdown = document.getElementById('adminProfileDropdown');
    
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('opacity-0');
        profileDropdown.classList.toggle('invisible');
        profileDropdown.classList.toggle('scale-95');
        profileDropdown.classList.toggle('scale-100');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        profileDropdown.classList.add('opacity-0', 'invisible', 'scale-95');
        profileDropdown.classList.remove('scale-100');
    });
    
    // User filters
    document.getElementById('roleFilter').addEventListener('change', filterUsers);
    document.getElementById('statusFilter').addEventListener('change', filterUsers);
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    
    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderUsersTable();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderUsersTable();
        }
    });
    
    
    // Edit user form
    document.getElementById('editUserForm').addEventListener('submit', handleEditUser);
    
    // Delegate Change PIN form submission (content injected in HTML)
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (form && form.id === 'changePinForm') {
            e.preventDefault();
            handleChangePin(form);
        }
    });
}

// Filter users
function filterUsers() {
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    
    filteredUsers = users.filter(user => {
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        const matchesSearch = !searchTerm || 
            (user.name && user.name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm));
        
        return matchesRole && matchesStatus && matchesSearch;
    });
    
    currentPage = 1;
    renderUsersTable();
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredUsers.length);
    
    document.getElementById('showingStart').textContent = startIndex;
    document.getElementById('showingEnd').textContent = endIndex;
    document.getElementById('totalRecords').textContent = filteredUsers.length;
    document.getElementById('currentPage').textContent = currentPage;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Modal functions

function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserName').value = user.name || '';
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserRole').value = user.role || '';
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserStatus').value = user.status || 'inactive';
    document.getElementById('editUserBadge').value = user.driverBadge || 'none';
    
    document.getElementById('editUserModal').classList.remove('hidden');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.add('hidden');
}


// Handle edit user
async function handleEditUser(e) {
    e.preventDefault();
    
    try {
        const userId = document.getElementById('editUserId').value;
        const userData = {
            name: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            role: document.getElementById('editUserRole').value,
            phone: document.getElementById('editUserPhone').value,
            status: document.getElementById('editUserStatus').value,
            driverBadge: document.getElementById('editUserBadge').value,
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'users', userId), userData);
        
        showAlert('User updated successfully', 'success');
        closeEditUserModal();
        loadUsers();
        
    } catch (error) {
        console.error('❌ Error updating user:', error);
        showAlert('Failed to update user', 'error');
    }
}

// Edit user function
function editUser(userId) {
    openEditUserModal(userId);
}

// Delete user function
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'users', userId));
        showAlert('User deleted successfully', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        showAlert('Failed to delete user', 'error');
    }
}

// Utility functions
function getStatusClass(status) {
    switch (status) {
        case 'active': return 'status-active';
        case 'inactive': return 'status-inactive';
        case 'pending': return 'status-pending';
        default: return 'status-inactive';
    }
}

function getRoleClass(role) {
    switch (role) {
        case 'farmer': return 'role-farmer';
        case 'worker': return 'role-worker';
        case 'sra': return 'role-sra';
        case 'admin': return 'role-admin';
        default: return 'role-worker';
    }
}

function getBadgeClass(badge) {
    switch (badge) {
        case 'approved': return 'status-badge';
        case 'pending': return 'status-pending';
        default: return 'status-no-badge';
    }
}

function getActivityIcon(eventType) {
    switch (eventType) {
        case 'successful_login': return 'fa-sign-in-alt';
        case 'failed_login': return 'fa-exclamation-triangle';
        case 'logout': return 'fa-sign-out-alt';
        case 'user_created': return 'fa-user-plus';
        case 'user_updated': return 'fa-user-edit';
        case 'user_deleted': return 'fa-user-times';
        default: return 'fa-info-circle';
    }
}

function getActivityColor(eventType) {
    switch (eventType) {
        case 'successful_login': return 'bg-green-500';
        case 'failed_login': return 'bg-red-500';
        case 'logout': return 'bg-blue-500';
        case 'user_created': return 'bg-green-500';
        case 'user_updated': return 'bg-yellow-500';
        case 'user_deleted': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

function getActivityMessage(log) {
    switch (log.eventType) {
        case 'successful_login':
            return `${log.details?.email || 'User'} logged in successfully`;
        case 'failed_login':
            return `Failed login attempt for ${log.details?.email || 'unknown user'}`;
        case 'logout':
            return `${log.details?.email || 'User'} logged out`;
        case 'user_created':
            return `New user created: ${log.details?.name || 'Unknown'}`;
        case 'user_updated':
            return `User updated: ${log.details?.name || 'Unknown'}`;
        case 'user_deleted':
            return `User deleted: ${log.details?.name || 'Unknown'}`;
        default:
            return log.details?.message || 'Unknown activity';
    }
}

function formatDate(date) {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

// Load analytics charts
async function loadAnalyticsCharts() {
    try {
        // Get all users for analytics
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = [];
        
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            allUsers.push({
                id: doc.id,
                ...userData,
                createdAt: userData.createdAt?.toDate() || new Date(),
                lastLogin: userData.lastLogin?.toDate() || null
            });
        });
        
        // Create user growth chart
        createUserGrowthChart(allUsers);
        
        // Create user role distribution chart
        createUserRoleChart(allUsers);
        
    } catch (error) {
        console.error('❌ Error loading analytics charts:', error);
    }
}

// Create user growth chart
function createUserGrowthChart(users) {
    const ctx = document.getElementById('userGrowthChart');
    if (!ctx) return;
    
    // Generate last 12 months data
    const months = [];
    const userCounts = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months.push(monthName);
        
        // Count users created in this month
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const usersInMonth = users.filter(user => {
            const userDate = user.createdAt;
            return userDate >= monthStart && userDate <= monthEnd;
        }).length;
        
        userCounts.push(usersInMonth);
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'New Users',
                data: userCounts,
                borderColor: '#7ccf00',
                backgroundColor: 'rgba(124, 207, 0, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#7ccf00',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                point: {
                    hoverBackgroundColor: '#7ccf00'
                }
            }
        }
    });
}

// Create user role distribution chart
function createUserRoleChart(users) {
    const ctx = document.getElementById('userRoleChart');
    if (!ctx) return;
    
    // Count users by role
    const roleCounts = {
        farmer: 0,
        worker: 0,
        sra: 0,
        admin: 0
    };
    
    users.forEach(user => {
        const role = user.role || 'worker';
        if (roleCounts.hasOwnProperty(role)) {
            roleCounts[role]++;
        }
    });
    
    const labels = Object.keys(roleCounts).map(role => 
        role.charAt(0).toUpperCase() + role.slice(1) + 's'
    );
    const data = Object.values(roleCounts);
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Fetch and render SRA officers
async function fetchAndRenderSRA() {
    try {
        // First, try to get from localStorage
        const sraOfficersData = localStorage.getItem('sraOfficers');
        let sraOfficers = [];
        
        if (sraOfficersData) {
            sraOfficers = JSON.parse(sraOfficersData);
        }
        
        // If no localStorage data, try to create a temporary admin user to fetch from Firestore
        if (sraOfficers.length === 0) {
            try {
                // Create a temporary admin user for fetching data
                const tempAdminEmail = 'temp-admin@canemap.com';
                const tempAdminPassword = 'TempAdmin123!';
                
                // Try to sign in as temp admin
                let tempAdmin = null;
                try {
                    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
                    tempAdmin = await signInWithEmailAndPassword(auth, tempAdminEmail, tempAdminPassword);
                } catch (signInError) {
                    // Create temp admin if doesn't exist
                    const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
                    const adminCredential = await createUserWithEmailAndPassword(auth, tempAdminEmail, tempAdminPassword);
                    tempAdmin = adminCredential.user;
                    await updateProfile(tempAdmin, { displayName: 'Temp Admin' });
                    
                    // Save admin to Firestore
                    await setDoc(doc(db, 'users', tempAdmin.uid), {
                        name: 'Temp Admin',
                        email: tempAdminEmail,
                        role: 'admin',
                        status: 'active',
                        createdAt: serverTimestamp(),
                    });
                }
                
                // Now fetch SRA officers
                const usersQuery = query(
                    collection(db, 'users'),
                    orderBy('createdAt', 'desc')
                );
                
                const querySnapshot = await getDocs(usersQuery);
                const firestoreSRAOfficers = [];
                
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData.role === 'sra_officer') {
                        firestoreSRAOfficers.push({
                            id: doc.id,
                            ...userData,
                            createdAt: userData.createdAt?.toDate() || new Date(),
                            lastLogin: userData.lastLogin?.toDate() || null
                        });
                    }
                });
                
                // Sign out temp admin
                const { signOut } = await import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js');
                await signOut(auth);
                
                sraOfficers = firestoreSRAOfficers;
                
                // Store in localStorage for future use
                localStorage.setItem('sraOfficers', JSON.stringify(sraOfficers));
                
            } catch (firestoreError) {
                console.log('Could not fetch from Firestore:', firestoreError.message);
            }
        }
        
        // Sort by creation date (newest first)
        sraOfficers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        renderSRATable(sraOfficers);
        
    } catch (error) {
        console.error('❌ Error loading SRA officers:', error);
        const tableBody = document.getElementById('sraTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-10">
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                            <p>Failed to load SRA officers</p>
                            <p class="text-sm mt-2">Error: ${error.message}</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// Render SRA officers table
function renderSRATable(sraOfficers) {
    const tbody = document.getElementById('sraTableBody');
    if (!tbody) return;
    
    if (sraOfficers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-user-tie text-2xl mb-2 text-gray-400"></i>
                        <p>No SRA officers found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    sraOfficers.forEach(officer => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = getStatusClass(officer.status);
        const emailVerified = officer.emailVerified ? 'Verified' : 'Pending';
        const emailVerifiedClass = officer.emailVerified ? 'text-green-600' : 'text-yellow-600';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-user-tie text-white text-sm"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${officer.name || 'N/A'}</div>
                        <div class="text-sm text-gray-500">${officer.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${officer.email || 'N/A'}</div>
                <div class="text-xs ${emailVerifiedClass}">${emailVerified}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${officer.status || 'inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="editUser('${officer.id}')" class="text-[var(--cane-600)] hover:text-[var(--cane-700)]">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUser('${officer.id}')" class="text-red-600 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Refresh SRA Officers function
function refreshSRAOfficers() {
    fetchAndRenderSRA();
}

// Debug function to clear SRA Officers data (for testing)
function clearSRAOfficersData() {
    localStorage.removeItem('sraOfficers');
    fetchAndRenderSRA();
    console.log('SRA Officers data cleared');
}

// Function to manually add existing SRA Officer data
function addExistingSRAOfficer() {
    // Check if data already exists
    const existingData = JSON.parse(localStorage.getItem('sraOfficers') || '[]');
    const existingEmail = 'almackieandrew.bangalao@evsu.edu.ph';
    
    if (existingData.some(officer => officer.email === existingEmail)) {
        alert('SRA Officer data already exists in localStorage!');
        return;
    }
    
    const officerData = {
        id: 'existing-sra-001', // You can use the actual UID from Firestore
        name: 'Almackie Bangalao',
        email: 'almackieandrew.bangalao@evsu.edu.ph',
        role: 'sra_officer',
        status: 'active',
        emailVerified: false,
        createdAt: new Date('2025-09-27T05:52:58.000Z').toISOString(), // Convert Firestore timestamp
        lastLogin: null
    };
    
    existingData.push(officerData);
    localStorage.setItem('sraOfficers', JSON.stringify(existingData));
    
    fetchAndRenderSRA();
    alert('Existing SRA Officer data loaded successfully!');
    console.log('Existing SRA Officer added to localStorage');
}

// Function to import all existing SRA Officers from a predefined list
function importAllExistingSRAOfficers() {
    const existingOfficers = [
        {
            id: 'existing-sra-001',
            name: 'Almackie Bangalao',
            email: 'almackieandrew.bangalao@evsu.edu.ph',
            role: 'sra_officer',
            status: 'active',
            emailVerified: false,
            createdAt: new Date('2025-09-27T05:52:58.000Z').toISOString(),
            lastLogin: null
        }
        // Add more existing SRA Officers here if needed
    ];
    
    const existingData = JSON.parse(localStorage.getItem('sraOfficers') || '[]');
    let addedCount = 0;
    
    existingOfficers.forEach(officer => {
        if (!existingData.some(existing => existing.email === officer.email)) {
            existingData.push(officer);
            addedCount++;
        }
    });
    
    if (addedCount > 0) {
        localStorage.setItem('sraOfficers', JSON.stringify(existingData));
        fetchAndRenderSRA();
        alert(`Imported ${addedCount} existing SRA Officer(s) successfully!`);
    } else {
        alert('All existing SRA Officers are already imported!');
    }
}

// Export functions for global access
window.editUser = editUser;
window.deleteUser = deleteUser;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.fetchAndRenderSRA = fetchAndRenderSRA;
window.refreshSRAOfficers = refreshSRAOfficers;
window.addExistingSRAOfficer = addExistingSRAOfficer;
window.importAllExistingSRAOfficers = importAllExistingSRAOfficers;
window.clearSRAOfficersData = clearSRAOfficersData;

// Add sample data for demonstration
async function addSampleData() {
    try {
        console.log('🔄 Adding sample data...');
        
        // Check if we already have data
        const usersSnapshot = await getDocs(collection(db, 'users'));
        if (usersSnapshot.size > 0) {
            console.log('📊 Sample data already exists, skipping...');
            return;
        }
        
        // Add sample users
        const sampleUsers = [
            {
                name: 'John Doe',
                email: 'john.doe@example.com',
                role: 'farmer',
                status: 'active',
                createdAt: serverTimestamp(),
                lastLogin: new Date(),
                driverBadge: 'none'
            },
            {
                name: 'Jane Smith',
                email: 'jane.smith@example.com',
                role: 'sra',
                status: 'active',
                createdAt: serverTimestamp(),
                lastLogin: new Date(),
                driverBadge: 'approved'
            },
            {
                name: 'Mike Johnson',
                email: 'mike.johnson@example.com',
                role: 'worker',
                status: 'active',
                createdAt: serverTimestamp(),
                lastLogin: new Date(),
                driverBadge: 'pending'
            }
        ];
        
        for (const user of sampleUsers) {
            await addDoc(collection(db, 'users'), user);
        }
        
        console.log('✅ Sample data added successfully');
        
        // Reload dashboard stats
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error adding sample data:', error);
    }
}

// Export functions for global access
window.initializeDashboard = initializeDashboard;
window.addSampleData = addSampleData;

// Handle Change PIN
async function handleChangePin(form){
    try{
        const currentPin = (new FormData(form).get('currentPin')||'').trim();
        const newPin = (new FormData(form).get('newPin')||'').trim();
        const confirmPin = (new FormData(form).get('confirmPin')||'').trim();
        if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin)){
            showAlert('PIN must be 6 digits','error');
            return;
        }
        if (newPin !== confirmPin){
            showAlert('New PIN and confirmation do not match','error');
            return;
        }
        // Verify current pin
        const qOld = query(collection(db,'admin_pins'), where('pin','==', currentPin), limit(1));
        const snapOld = await getDocs(qOld);
        if (snapOld.empty){
            showAlert('Current PIN is incorrect','error');
            return;
        }
        const docRef = snapOld.docs[0].ref;
        await updateDoc(docRef, { pin: newPin, updatedAt: serverTimestamp() });
        showAlert('PIN updated successfully','success');
        form.reset();
    }catch(e){
        console.error('Change PIN failed', e);
        showAlert('Failed to update PIN','error');
    }
}
