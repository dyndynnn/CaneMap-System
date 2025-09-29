// Maintenance Management System
// Handles system maintenance, monitoring, and optimization

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

// Global variables for maintenance management
let currentTab = 'backup';
let isMonitoring = false;
let monitoringInterval = null;
let performanceData = {
    cpu: [],
    memory: [],
    responseTime: []
};

// Initialize maintenance management system
export function initializeMaintenance() {
    console.log('🔄 Initializing maintenance management...');
    
    // Set up event listeners
    setupMaintenanceEventListeners();
    
    // Load initial data
    loadSystemHealth();
    loadBackups();
    
    console.log('✅ Maintenance management initialized successfully');
}

// Set up event listeners for maintenance management
function setupMaintenanceEventListeners() {
    // Tab switching
    document.querySelectorAll('.maintenance-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.closest('.maintenance-tab').id.replace('tab-', '');
            showMaintenanceTab(tabId);
        });
    });
    
    // Error level filter
    const errorLevelFilter = document.getElementById('errorLevelFilter');
    if (errorLevelFilter) {
        errorLevelFilter.addEventListener('change', () => {
            filterErrorLogs();
        });
    }
    
    // Schedule form submission
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleScheduleFormSubmit);
    }
}

// Show maintenance tab content
export function showMaintenanceTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.maintenance-tab').forEach(tab => {
        tab.classList.remove('active', 'border-[var(--cane-600)]', 'text-[var(--cane-600)]');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.add('active', 'border-[var(--cane-600)]', 'text-[var(--cane-600)]');
        activeTab.classList.remove('border-transparent', 'text-gray-500');
    }
    
    // Update tab content
    document.querySelectorAll('.maintenance-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`content-${tabId}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
    
    currentTab = tabId;
    
    // Load tab-specific data
    switch(tabId) {
        case 'backup':
            loadBackups();
            break;
        case 'updates':
            loadSystemUpdates();
            break;
        case 'cleanup':
            loadCleanupData();
            break;
        case 'performance':
            loadPerformanceData();
            break;
        case 'errors':
            loadErrorLogs();
            break;
        case 'schedule':
            loadScheduledMaintenance();
            break;
    }
}

// Load system health overview
async function loadSystemHealth() {
    try {
        // Simulate system health data (in real implementation, this would come from system monitoring)
        const healthData = {
            status: 'Healthy',
            uptime: '99.9%',
            cpuUsage: Math.floor(Math.random() * 100),
            memoryUsage: (Math.random() * 4 + 1).toFixed(1) + 'GB',
            responseTime: Math.floor(Math.random() * 200 + 50) + 'ms'
        };
        
        // Update UI
        document.getElementById('systemStatus').textContent = healthData.status;
        document.getElementById('uptime').textContent = healthData.uptime;
        document.getElementById('cpuUsage').textContent = healthData.cpuUsage + '%';
        document.getElementById('memoryUsage').textContent = healthData.memoryUsage;
        document.getElementById('responseTime').textContent = healthData.responseTime;
        
        // Update trends (simulated)
        document.getElementById('cpuTrend').textContent = (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 5) + '%';
        document.getElementById('memoryTrend').textContent = (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 0.5).toFixed(1) + 'GB';
        document.getElementById('responseTrend').textContent = (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 20) + 'ms';
        
    } catch (error) {
        console.error('❌ Error loading system health:', error);
    }
}

// Load backups
async function loadBackups() {
    try {
        const backupsQuery = query(
            collection(db, 'system_backups'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(backupsQuery);
        const backups = [];
        
        querySnapshot.forEach((doc) => {
            const backupData = doc.data();
            backups.push({
                id: doc.id,
                ...backupData,
                createdAt: backupData.createdAt?.toDate() || new Date()
            });
        });
        
        renderBackups(backups);
        
    } catch (error) {
        console.error('❌ Error loading backups:', error);
        showMaintenanceError('Failed to load backups');
    }
}

// Render backups table
function renderBackups(backups) {
    const tbody = document.getElementById('backupsTableBody');
    if (!tbody) return;
    
    if (backups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-database text-2xl mb-2 text-gray-400"></i>
                        <p>No backups found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    backups.forEach(backup => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = backup.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          backup.status === 'failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${backup.name || 'Backup_' + backup.id}</div>
                <div class="text-sm text-gray-500">${backup.type || 'Full'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${backup.type || 'Full'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${backup.size || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(backup.createdAt)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${backup.status || 'Unknown'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="downloadBackup('${backup.id}')" class="text-blue-600 hover:text-blue-700" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button onclick="restoreBackup('${backup.id}')" class="text-green-600 hover:text-green-700" title="Restore">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button onclick="deleteBackup('${backup.id}')" class="text-red-600 hover:text-red-700" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load system updates
async function loadSystemUpdates() {
    try {
        // Simulate available updates
        const updates = [
            {
                id: 'update-001',
                name: 'Security Patch v2.1.5',
                version: '2.1.5',
                type: 'security',
                size: '15.2 MB',
                description: 'Critical security updates and bug fixes',
                releaseDate: new Date('2024-01-20'),
                isRequired: true
            },
            {
                id: 'update-002',
                name: 'Feature Update v2.2.0',
                version: '2.2.0',
                type: 'feature',
                size: '45.8 MB',
                description: 'New features and performance improvements',
                releaseDate: new Date('2024-01-25'),
                isRequired: false
            }
        ];
        
        renderSystemUpdates(updates);
        
    } catch (error) {
        console.error('❌ Error loading system updates:', error);
    }
}

// Render system updates
function renderSystemUpdates(updates) {
    const updatesList = document.getElementById('updatesList');
    if (!updatesList) return;
    
    if (updates.length === 0) {
        updatesList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                <p>System is up to date</p>
            </div>
        `;
        return;
    }
    
    updatesList.innerHTML = '';
    
    updates.forEach(update => {
        const updateDiv = document.createElement('div');
        updateDiv.className = 'border border-gray-200 rounded-lg p-4';
        
        const typeClass = update.type === 'security' ? 'bg-red-100 text-red-800' : 
                         update.type === 'feature' ? 'bg-blue-100 text-blue-800' : 
                         'bg-gray-100 text-gray-800';
        
        updateDiv.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <h5 class="font-medium text-gray-900">${update.name}</h5>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${typeClass}">
                            ${update.type}
                        </span>
                        ${update.isRequired ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Required</span>' : ''}
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${update.description}</p>
                    <div class="flex items-center gap-4 text-xs text-gray-500">
                        <span>Size: ${update.size}</span>
                        <span>Released: ${formatDate(update.releaseDate)}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button onclick="installUpdate('${update.id}')" class="px-3 py-1 bg-[var(--cane-600)] text-white rounded-md text-sm hover:bg-[var(--cane-700)] transition-colors">
                        Install
                    </button>
                    <button onclick="viewUpdateDetails('${update.id}')" class="px-3 py-1 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition-colors">
                        Details
                    </button>
                </div>
            </div>
        `;
        
        updatesList.appendChild(updateDiv);
    });
}

// Load cleanup data
async function loadCleanupData() {
    try {
        // Simulate cleanup data
        const cleanupData = {
            oldLogs: Math.floor(Math.random() * 2000) + 500,
            tempFiles: Math.floor(Math.random() * 1000) + 200,
            cacheFiles: Math.floor(Math.random() * 200) + 50,
            expiredSessions: Math.floor(Math.random() * 100) + 20,
            databaseSize: (Math.random() * 5 + 1).toFixed(1) + ' GB',
            logsSize: (Math.random() * 2 + 0.5).toFixed(1) + ' GB',
            tempSize: (Math.random() * 1 + 0.1).toFixed(1) + ' GB',
            reclaimableSize: (Math.random() * 2 + 0.5).toFixed(1) + ' GB'
        };
        
        // Update UI
        document.getElementById('oldLogsCount').textContent = cleanupData.oldLogs.toLocaleString() + ' files';
        document.getElementById('tempFilesCount').textContent = cleanupData.tempFiles.toLocaleString() + ' files';
        document.getElementById('cacheFilesCount').textContent = cleanupData.cacheFiles.toLocaleString() + ' files';
        document.getElementById('expiredSessionsCount').textContent = cleanupData.expiredSessions.toLocaleString() + ' sessions';
        document.getElementById('databaseSize').textContent = cleanupData.databaseSize;
        document.getElementById('logsSize').textContent = cleanupData.logsSize;
        document.getElementById('tempSize').textContent = cleanupData.tempSize;
        document.getElementById('reclaimableSize').textContent = cleanupData.reclaimableSize;
        
        // Load cleanup history
        loadCleanupHistory();
        
    } catch (error) {
        console.error('❌ Error loading cleanup data:', error);
    }
}

// Load cleanup history
async function loadCleanupHistory() {
    try {
        const cleanupQuery = query(
            collection(db, 'cleanup_history'),
            orderBy('createdAt', 'desc'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(cleanupQuery);
        const cleanupHistory = [];
        
        querySnapshot.forEach((doc) => {
            const cleanupData = doc.data();
            cleanupHistory.push({
                id: doc.id,
                ...cleanupData,
                createdAt: cleanupData.createdAt?.toDate() || new Date()
            });
        });
        
        renderCleanupHistory(cleanupHistory);
        
    } catch (error) {
        console.error('❌ Error loading cleanup history:', error);
    }
}

// Render cleanup history
function renderCleanupHistory(history) {
    const tbody = document.getElementById('cleanupTableBody');
    if (!tbody) return;
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-broom text-2xl mb-2 text-gray-400"></i>
                        <p>No cleanup history found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    history.forEach(cleanup => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = cleanup.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          cleanup.status === 'failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(cleanup.createdAt)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${cleanup.type || 'General'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${cleanup.filesRemoved || 0}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${cleanup.spaceFreed || '0 MB'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${cleanup.status || 'Unknown'}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load performance data
async function loadPerformanceData() {
    try {
        // Initialize performance charts
        initializePerformanceCharts();
        
        // Load current performance metrics
        updatePerformanceMetrics();
        
    } catch (error) {
        console.error('❌ Error loading performance data:', error);
    }
}

// Initialize performance charts
function initializePerformanceCharts() {
    // CPU Chart
    const cpuCtx = document.getElementById('cpuChart');
    if (cpuCtx) {
        new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 20}, (_, i) => i),
                datasets: [{
                    label: 'CPU Usage %',
                    data: Array.from({length: 20}, () => Math.floor(Math.random() * 100)),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
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
                        max: 100
                    }
                }
            }
        });
    }
    
    // Memory Chart
    const memoryCtx = document.getElementById('memoryChart');
    if (memoryCtx) {
        new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 20}, (_, i) => i),
                datasets: [{
                    label: 'Memory Usage GB',
                    data: Array.from({length: 20}, () => Math.random() * 4 + 1),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
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
                        max: 8
                    }
                }
            }
        });
    }
}

// Update performance metrics
function updatePerformanceMetrics() {
    // Simulate performance data
    const metrics = {
        avgResponseTime: Math.floor(Math.random() * 200 + 50) + 'ms',
        minResponseTime: Math.floor(Math.random() * 100 + 30) + 'ms',
        maxResponseTime: Math.floor(Math.random() * 500 + 200) + 'ms',
        queryTime: Math.floor(Math.random() * 50 + 5) + 'ms',
        dbConnections: Math.floor(Math.random() * 50 + 10) + '/50',
        cacheHit: Math.floor(Math.random() * 20 + 80) + '%',
        loadAverage: (Math.random() * 2 + 0.1).toFixed(2),
        activeUsers: Math.floor(Math.random() * 50 + 10),
        requestsPerMin: Math.floor(Math.random() * 200 + 50)
    };
    
    // Update UI
    Object.keys(metrics).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.textContent = metrics[key];
        }
    });
}

// Load error logs
async function loadErrorLogs() {
    try {
        const errorsQuery = query(
            collection(db, 'system_errors'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );
        
        const querySnapshot = await getDocs(errorsQuery);
        const errorLogs = [];
        
        querySnapshot.forEach((doc) => {
            const errorData = doc.data();
            errorLogs.push({
                id: doc.id,
                ...errorData,
                timestamp: errorData.timestamp?.toDate() || new Date()
            });
        });
        
        renderErrorLogs(errorLogs);
        updateErrorCounts(errorLogs);
        
    } catch (error) {
        console.error('❌ Error loading error logs:', error);
    }
}

// Render error logs
function renderErrorLogs(logs) {
    const logsContainer = document.getElementById('errorLogs');
    if (!logsContainer) return;
    
    if (logs.length === 0) {
        logsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                <p>No errors found</p>
            </div>
        `;
        return;
    }
    
    logsContainer.innerHTML = '';
    
    logs.forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = 'flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200';
        
        const levelClass = getErrorLevelClass(log.level);
        const iconClass = getErrorIcon(log.level);
        
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
                <div class="flex items-center gap-2 mt-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${levelClass}">
                        ${log.level || 'info'}
                    </span>
                    <span class="text-xs text-gray-500">${log.source || 'System'}</span>
                </div>
            </div>
        `;
        
        logsContainer.appendChild(logDiv);
    });
}

// Update error counts
function updateErrorCounts(logs) {
    const counts = {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0
    };
    
    logs.forEach(log => {
        const level = log.level || 'info';
        if (counts.hasOwnProperty(level)) {
            counts[level]++;
        }
    });
    
    document.getElementById('criticalErrors').textContent = counts.critical;
    document.getElementById('errorCount').textContent = counts.error;
    document.getElementById('warningCount').textContent = counts.warning;
    document.getElementById('infoCount').textContent = counts.info;
}

// Load scheduled maintenance
async function loadScheduledMaintenance() {
    try {
        const maintenanceQuery = query(
            collection(db, 'scheduled_maintenance'),
            orderBy('scheduledAt', 'asc')
        );
        
        const querySnapshot = await getDocs(maintenanceQuery);
        const scheduledMaintenance = [];
        
        querySnapshot.forEach((doc) => {
            const maintenanceData = doc.data();
            scheduledMaintenance.push({
                id: doc.id,
                ...maintenanceData,
                scheduledAt: maintenanceData.scheduledAt?.toDate() || new Date()
            });
        });
        
        renderScheduledMaintenance(scheduledMaintenance);
        loadMaintenanceHistory();
        
    } catch (error) {
        console.error('❌ Error loading scheduled maintenance:', error);
    }
}

// Render scheduled maintenance
function renderScheduledMaintenance(maintenance) {
    const container = document.getElementById('scheduledMaintenance');
    if (!container) return;
    
    if (maintenance.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-calendar-alt text-2xl mb-2 text-gray-400"></i>
                <p>No scheduled maintenance</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    maintenance.forEach(item => {
        const maintenanceDiv = document.createElement('div');
        maintenanceDiv.className = 'border border-gray-200 rounded-lg p-4';
        
        const statusClass = item.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 
                          item.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800';
        
        maintenanceDiv.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <h5 class="font-medium text-gray-900">${item.type || 'Maintenance'}</h5>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                            ${item.status || 'scheduled'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${item.description || 'No description'}</p>
                    <div class="flex items-center gap-4 text-xs text-gray-500">
                        <span>Scheduled: ${formatDateTime(item.scheduledAt)}</span>
                        <span>Duration: ${item.duration || 30} minutes</span>
                    </div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button onclick="cancelMaintenance('${item.id}')" class="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(maintenanceDiv);
    });
}

// Load maintenance history
async function loadMaintenanceHistory() {
    try {
        const historyQuery = query(
            collection(db, 'maintenance_history'),
            orderBy('startedAt', 'desc'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(historyQuery);
        const history = [];
        
        querySnapshot.forEach((doc) => {
            const historyData = doc.data();
            history.push({
                id: doc.id,
                ...historyData,
                startedAt: historyData.startedAt?.toDate() || new Date(),
                completedAt: historyData.completedAt?.toDate() || null
            });
        });
        
        renderMaintenanceHistory(history);
        
    } catch (error) {
        console.error('❌ Error loading maintenance history:', error);
    }
}

// Render maintenance history
function renderMaintenanceHistory(history) {
    const tbody = document.getElementById('maintenanceHistoryTableBody');
    if (!tbody) return;
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-history text-2xl mb-2 text-gray-400"></i>
                        <p>No maintenance history found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    history.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = item.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          item.status === 'failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800';
        
        const duration = item.completedAt ? 
            Math.round((item.completedAt - item.startedAt) / 60000) + ' min' : 
            'In Progress';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(item.startedAt)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${duration}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.type || 'General'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.description || 'No description'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${item.status || 'Unknown'}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Action functions
export async function createBackup() {
    try {
        const backupOptions = {
            users: document.getElementById('backupUsers').checked,
            fields: document.getElementById('backupFields').checked,
            logs: document.getElementById('backupLogs').checked,
            settings: document.getElementById('backupSettings').checked
        };
        
        const backupData = {
            name: 'Backup_' + new Date().toISOString().split('T')[0],
            type: 'Manual',
            options: backupOptions,
            status: 'in-progress',
            createdAt: serverTimestamp(),
            createdBy: 'admin'
        };
        
        await addDoc(collection(db, 'system_backups'), backupData);
        
        showMaintenanceAlert('Backup creation started', 'success');
        loadBackups();
        
    } catch (error) {
        console.error('❌ Error creating backup:', error);
        showMaintenanceAlert('Failed to create backup', 'error');
    }
}

export async function restoreBackup(backupId) {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
        return;
    }
    
    try {
        await updateDoc(doc(db, 'system_backups', backupId), {
            restoreStatus: 'in-progress',
            restoredAt: serverTimestamp(),
            restoredBy: 'admin'
        });
        
        showMaintenanceAlert('Backup restore started', 'success');
        loadBackups();
        
    } catch (error) {
        console.error('❌ Error restoring backup:', error);
        showMaintenanceAlert('Failed to restore backup', 'error');
    }
}

export async function deleteBackup(backupId) {
    if (!confirm('Are you sure you want to delete this backup?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'system_backups', backupId));
        
        showMaintenanceAlert('Backup deleted successfully', 'success');
        loadBackups();
        
    } catch (error) {
        console.error('❌ Error deleting backup:', error);
        showMaintenanceAlert('Failed to delete backup', 'error');
    }
}

export async function installUpdate(updateId) {
    if (!confirm('Are you sure you want to install this update? The system may be temporarily unavailable.')) {
        return;
    }
    
    try {
        const updateData = {
            updateId: updateId,
            status: 'installing',
            startedAt: serverTimestamp(),
            installedBy: 'admin'
        };
        
        await addDoc(collection(db, 'update_history'), updateData);
        
        showMaintenanceAlert('Update installation started', 'success');
        loadSystemUpdates();
        
    } catch (error) {
        console.error('❌ Error installing update:', error);
        showMaintenanceAlert('Failed to install update', 'error');
    }
}

export async function runCleanup() {
    if (!confirm('Are you sure you want to run cleanup? This action cannot be undone.')) {
        return;
    }
    
    try {
        const cleanupOptions = {
            oldLogs: document.getElementById('cleanupOldLogs').checked,
            tempFiles: document.getElementById('cleanupTempFiles').checked,
            cache: document.getElementById('cleanupCache').checked,
            sessions: document.getElementById('cleanupSessions').checked
        };
        
        const cleanupData = {
            type: 'Manual',
            options: cleanupOptions,
            status: 'in-progress',
            createdAt: serverTimestamp(),
            createdBy: 'admin'
        };
        
        await addDoc(collection(db, 'cleanup_history'), cleanupData);
        
        showMaintenanceAlert('Cleanup started', 'success');
        loadCleanupData();
        
    } catch (error) {
        console.error('❌ Error running cleanup:', error);
        showMaintenanceAlert('Failed to run cleanup', 'error');
    }
}

export function startMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    monitoringInterval = setInterval(() => {
        updatePerformanceMetrics();
        // Update charts with new data
        updatePerformanceCharts();
    }, 5000);
    
    showMaintenanceAlert('Performance monitoring started', 'success');
}

export function stopMonitoring() {
    if (!isMonitoring) return;
    
    isMonitoring = false;
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    showMaintenanceAlert('Performance monitoring stopped', 'success');
}

export async function toggleMaintenanceMode() {
    if (!confirm('Are you sure you want to enable maintenance mode? Users will not be able to access the system.')) {
        return;
    }
    
    try {
        const maintenanceData = {
            enabled: true,
            enabledAt: serverTimestamp(),
            enabledBy: 'admin',
            message: 'System is currently under maintenance. Please try again later.'
        };
        
        await addDoc(collection(db, 'maintenance_mode'), maintenanceData);
        
        showMaintenanceAlert('Maintenance mode enabled', 'success');
        loadScheduledMaintenance();
        
    } catch (error) {
        console.error('❌ Error enabling maintenance mode:', error);
        showMaintenanceAlert('Failed to enable maintenance mode', 'error');
    }
}

// Modal functions
export function openScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) modal.classList.add('hidden');
}

// Form handlers
async function handleScheduleFormSubmit(e) {
    e.preventDefault();
    
    try {
        const scheduleData = {
            type: document.getElementById('maintenanceType').value,
            scheduledAt: new Date(document.getElementById('startDateTime').value),
            duration: parseInt(document.getElementById('duration').value),
            description: document.getElementById('maintenanceDescription').value,
            notifyUsers: document.getElementById('notifyUsers').checked,
            notifyAdmins: document.getElementById('notifyAdmins').checked,
            status: 'scheduled',
            createdAt: serverTimestamp(),
            createdBy: 'admin'
        };
        
        await addDoc(collection(db, 'scheduled_maintenance'), scheduleData);
        
        showMaintenanceAlert('Maintenance scheduled successfully', 'success');
        closeScheduleModal();
        loadScheduledMaintenance();
        
    } catch (error) {
        console.error('❌ Error scheduling maintenance:', error);
        showMaintenanceAlert('Failed to schedule maintenance', 'error');
    }
}

// Refresh functions
export function refreshBackups() {
    loadBackups();
}

export function refreshUpdates() {
    loadSystemUpdates();
}

export function refreshCleanup() {
    loadCleanupData();
}

export function refreshErrors() {
    loadErrorLogs();
}

// Filter functions
function filterErrorLogs() {
    const levelFilter = document.getElementById('errorLevelFilter')?.value || 'all';
    
    if (levelFilter === 'all') {
        loadErrorLogs();
        return;
    }
    
    // Filter logs by level (implementation would filter the loaded logs)
    showMaintenanceAlert(`Filtering logs by level: ${levelFilter}`, 'info');
}

// Utility functions
function getErrorLevelClass(level) {
    switch (level) {
        case 'critical': return 'bg-red-700';
        case 'error': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        case 'info': return 'bg-blue-500';
        default: return 'bg-gray-500';
    }
}

function getErrorIcon(level) {
    switch (level) {
        case 'critical': return 'fa-times-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-info-circle';
    }
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
}

// Update performance charts
function updatePerformanceCharts() {
    // This would update the Chart.js charts with new data
    // Implementation depends on how charts are managed
}

// Show maintenance alert
function showMaintenanceAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 right-4 z-50 max-w-md';
    
    const bgColor = type === 'success' ? 'bg-green-500' : 
                   type === 'warning' ? 'bg-yellow-500' : 
                   type === 'info' ? 'bg-blue-500' : 'bg-red-500';
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'warning' ? 'fa-exclamation-triangle' : 
                type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle';
    
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

// Show maintenance error
function showMaintenanceError(message) {
    const tbody = document.getElementById('backupsTableBody');
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
window.initializeMaintenance = initializeMaintenance;
window.showMaintenanceTab = showMaintenanceTab;
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.deleteBackup = deleteBackup;
window.installUpdate = installUpdate;
window.runCleanup = runCleanup;
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.toggleMaintenanceMode = toggleMaintenanceMode;
window.openScheduleModal = openScheduleModal;
window.closeScheduleModal = closeScheduleModal;
window.refreshBackups = refreshBackups;
window.refreshUpdates = refreshUpdates;
window.refreshCleanup = refreshCleanup;
window.refreshErrors = refreshErrors;
