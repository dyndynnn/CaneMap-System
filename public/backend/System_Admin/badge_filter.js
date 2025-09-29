// Badge Filter Management
// Handles badge request filtering and status management

import { auth, db } from '../Common/firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// Global variables for badge filtering
let badgeRequests = [];
let filteredBadgeRequests = [];
let currentBadgePage = 1;
let badgeItemsPerPage = 10;

// Initialize badge filter functionality
export function initializeBadgeFilter() {
    console.log('🔄 Initializing badge filter...');
    
    // Set up event listeners for badge filters
    setupBadgeFilterEventListeners();
    
    // Load initial badge requests
    loadBadgeRequests();
    
    console.log('✅ Badge filter initialized successfully');
}

// Set up event listeners for badge filter buttons
function setupBadgeFilterEventListeners() {
    // Wait for DOM to be ready
    setTimeout(() => {
        const badgeFilterButtons = document.querySelectorAll('.badge-filter');
        
        badgeFilterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.getAttribute('data-status');
                handleBadgeFilterClick(btn, status);
            });
        });
        
        // Page size handler
        const pageSizeSelect = document.getElementById('badgePageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => {
                badgeItemsPerPage = parseInt(pageSizeSelect.value);
                currentBadgePage = 1;
                renderBadgeRequestsTable();
            });
        }
    }, 100);
}

// Handle badge filter button clicks
function handleBadgeFilterClick(clickedBtn, status) {
    // Update active filter styling
    document.querySelectorAll('.badge-filter').forEach(btn => {
        if (btn === clickedBtn) {
            // Active state - apply appropriate color based on status
            btn.className = btn.className.replace(/bg-white|bg-gray-100|text-gray-700|border-gray-300|hover:bg-\w+-50|hover:border-\w+-300|hover:text-\w+-700/g, '');
            
            // Apply status-specific active styling
            switch(status) {
                case 'all':
                    btn.className += ' bg-[var(--cane-600)] text-white shadow-md border-[var(--cane-600)]';
                    btn.classList.add('hover:bg-[var(--cane-700)]');
                    break;
                case 'pending':
                    btn.className += ' bg-yellow-500 text-white shadow-md border-yellow-500';
                    btn.classList.add('hover:bg-yellow-600');
                    break;
                case 'approved':
                    btn.className += ' bg-green-500 text-white shadow-md border-green-500';
                    btn.classList.add('hover:bg-green-600');
                    break;
                case 'rejected':
                    btn.className += ' bg-red-500 text-white shadow-md border-red-500';
                    btn.classList.add('hover:bg-red-600');
                    break;
            }
        } else {
            // Inactive state - reset to default styling
            btn.className = btn.className.replace(/bg-\[var\(--cane-600\)\]|bg-yellow-500|bg-green-500|bg-red-500|text-white|shadow-md|border-\[var\(--cane-600\)\]|border-yellow-500|border-green-500|border-red-500|hover:bg-\[var\(--cane-700\)\]|hover:bg-yellow-600|hover:bg-green-600|hover:bg-red-600/g, '');
            btn.className += ' bg-white text-gray-700 border border-gray-300 shadow-sm';
            
            // Apply status-specific hover colors
            const btnStatus = btn.getAttribute('data-status');
            switch(btnStatus) {
                case 'pending':
                    btn.classList.add('hover:bg-yellow-50', 'hover:border-yellow-300', 'hover:text-yellow-700');
                    break;
                case 'approved':
                    btn.classList.add('hover:bg-green-50', 'hover:border-green-300', 'hover:text-green-700');
                    break;
                case 'rejected':
                    btn.classList.add('hover:bg-red-50', 'hover:border-red-300', 'hover:text-red-700');
                    break;
                default:
                    btn.classList.add('hover:bg-[var(--cane-50)]', 'hover:border-[var(--cane-300)]', 'hover:text-[var(--cane-700)]');
            }
        }
    });
    
    // Update active filter indicator
    updateActiveBadgeFilterIndicator(status);
    
    // Filter and render badge requests
    filterBadgeRequests(status);
}

// Update the active filter indicator
function updateActiveBadgeFilterIndicator(status) {
    const activeFilterName = document.getElementById('activeBadgeFilterName');
    if (activeFilterName) {
        const filterNames = {
            'all': 'All Requests',
            'pending': 'Pending Requests',
            'approved': 'Approved Requests',
            'rejected': 'Rejected Requests'
        };
        activeFilterName.textContent = filterNames[status] || status;
    }
}

// Load badge requests from Firebase
async function loadBadgeRequests() {
    try {
        console.log('🔄 Loading badge requests...');
        
        const badgeQuery = query(
            collection(db, 'driver_badge_requests'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(badgeQuery);
        badgeRequests = [];
        
        querySnapshot.forEach((doc) => {
            const requestData = doc.data();
            badgeRequests.push({
                id: doc.id,
                ...requestData,
                createdAt: requestData.createdAt?.toDate() || new Date()
            });
        });
        
        filteredBadgeRequests = [...badgeRequests];
        console.log(`📊 Loaded ${badgeRequests.length} badge requests`);
        
        // Render the table
        renderBadgeRequestsTable();
        
    } catch (error) {
        console.error('❌ Error loading badge requests:', error);
        showBadgeError('Failed to load badge requests');
    }
}

// Filter badge requests by status
function filterBadgeRequests(status) {
    if (status === 'all') {
        filteredBadgeRequests = [...badgeRequests];
    } else {
        filteredBadgeRequests = badgeRequests.filter(request => 
            request.status === status
        );
    }
    
    currentBadgePage = 1;
    renderBadgeRequestsTable();
}

// Render badge requests table
function renderBadgeRequestsTable() {
    const tbody = document.getElementById('badgeRequestsTableBody');
    if (!tbody) return;
    
    const startIndex = (currentBadgePage - 1) * badgeItemsPerPage;
    const endIndex = startIndex + badgeItemsPerPage;
    const pageRequests = filteredBadgeRequests.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (pageRequests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-id-badge text-2xl mb-2 text-gray-400"></i>
                        <p>No badge requests found</p>
                    </div>
                </td>
            </tr>
        `;
        updateBadgePagination();
        return;
    }
    
    pageRequests.forEach(request => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = getBadgeStatusClass(request.status);
        const createdDate = request.createdAt ? formatDate(request.createdAt) : 'N/A';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-id-badge text-white text-sm"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${request.name || 'N/A'}</div>
                        <div class="text-sm text-gray-500">${request.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${request.licenseNo || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdDate}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${request.status || 'pending'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="viewBadgeDetails('${request.id}')" class="text-blue-600 hover:text-blue-700" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${request.status === 'pending' ? `
                        <button onclick="approveBadgeRequest('${request.id}')" class="text-green-600 hover:text-green-700" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button onclick="rejectBadgeRequest('${request.id}')" class="text-red-600 hover:text-red-700" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateBadgePagination();
}

// Update badge pagination
function updateBadgePagination() {
    const total = filteredBadgeRequests.length;
    const start = total === 0 ? 0 : (currentBadgePage - 1) * badgeItemsPerPage + 1;
    const end = Math.min(currentBadgePage * badgeItemsPerPage, total);
    
    const totalEl = document.getElementById('badgeTotal');
    const startEl = document.getElementById('badgeShowingStart');
    const endEl = document.getElementById('badgeShowingEnd');
    
    if (totalEl) totalEl.textContent = total;
    if (startEl) startEl.textContent = start;
    if (endEl) endEl.textContent = end;
}

// Get badge status class for styling
function getBadgeStatusClass(status) {
    switch (status) {
        case 'approved': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Format date for display
function formatDate(date) {
    if (!date) return 'N/A';
    
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

// Show badge error message
function showBadgeError(message) {
    const tbody = document.getElementById('badgeRequestsTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-red-500">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Approve badge request
export async function approveBadgeRequest(requestId) {
    try {
        await updateDoc(doc(db, 'driver_badge_requests', requestId), {
            status: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: 'system_admin'
        });
        
        showBadgeAlert('Badge request approved successfully', 'success');
        loadBadgeRequests();
        
    } catch (error) {
        console.error('❌ Error approving badge request:', error);
        showBadgeAlert('Failed to approve badge request', 'error');
    }
}

// Reject badge request
export async function rejectBadgeRequest(requestId) {
    try {
        await updateDoc(doc(db, 'driver_badge_requests', requestId), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
            rejectedBy: 'system_admin'
        });
        
        showBadgeAlert('Badge request rejected successfully', 'success');
        loadBadgeRequests();
        
    } catch (error) {
        console.error('❌ Error rejecting badge request:', error);
        showBadgeAlert('Failed to reject badge request', 'error');
    }
}

// Show badge alert
function showBadgeAlert(message, type = 'success') {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 right-4 z-50 max-w-md';
    
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
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

// Export functions for global access
window.initializeBadgeFilter = initializeBadgeFilter;
window.approveBadgeRequest = approveBadgeRequest;
window.rejectBadgeRequest = rejectBadgeRequest;
