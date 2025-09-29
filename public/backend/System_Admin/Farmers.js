// Farmers Management System
// Handles farmer filtering, data loading, and table rendering

import { auth, db } from '../Common/firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// Global variables for farmers management
let farmers = [];
let filteredFarmers = [];
let currentFarmersPage = 1;
let farmersItemsPerPage = 10;

// Initialize farmers management system
export function initializeFarmers() {
    console.log('🔄 Initializing farmers management...');
    
    // Set up event listeners for farmer filters
    setupFarmerFilterEventListeners();
    
    // Load initial farmers data
    loadFarmers();
    
    console.log('✅ Farmers management initialized successfully');
}

// Set up event listeners for farmer filter buttons
function setupFarmerFilterEventListeners() {
    // Wait for DOM to be ready
    setTimeout(() => {
        // Search functionality
        const searchInput = document.getElementById('farmerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value;
                applyFilters();
            });
        }
        
        // Role filter
        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => {
                applyFilters();
            });
        }
        
        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                applyFilters();
            });
        }
        
        // Page size handler
        const pageSizeSelect = document.getElementById('farmersPageSize');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => {
                farmersItemsPerPage = parseInt(pageSizeSelect.value);
                currentFarmersPage = 1;
                renderFarmersTable();
            });
        }
    }, 100);
}

// Handle farmer filter button clicks
function handleFarmerFilterClick(clickedBtn, filterType) {
    // Update active filter styling
    document.querySelectorAll('.farmer-filter').forEach(btn => {
        if (btn === clickedBtn) {
            // Active state
            btn.className = btn.className.replace(/bg-white|bg-gray-100|text-gray-700|border-gray-300|hover:bg-\[var\(--cane-50\)\]|hover:border-\[var\(--cane-300\)\]|hover:text-\[var\(--cane-700\)\]/g, '');
            btn.className += ' bg-[var(--cane-600)] text-white shadow-md border-[var(--cane-600)]';
            btn.classList.remove('hover:bg-[var(--cane-50)]', 'hover:border-[var(--cane-300)]', 'hover:text-[var(--cane-700)]');
            btn.classList.add('hover:bg-[var(--cane-700)]');
        } else {
            // Inactive state
            btn.className = btn.className.replace(/bg-\[var\(--cane-600\)\]|text-white|shadow-md|border-\[var\(--cane-600\)\]|hover:bg-\[var\(--cane-700\)\]/g, '');
            btn.className += ' bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-[var(--cane-50)] hover:border-[var(--cane-300)] hover:text-[var(--cane-700)]';
        }
    });
    
    // Update active filter indicator
    updateActiveFarmerFilterIndicator(filterType);
    
    // Filter and render farmers
    filterFarmers(filterType);
}

// Update the active filter indicator
function updateActiveFarmerFilterIndicator(filterType) {
    const activeFilterName = document.getElementById('activeFilterName');
    if (activeFilterName) {
        const filterNames = {
            'all': 'All Farmers',
            'Field Handler': 'Field Handlers',
            'Field Worker': 'Field Workers',
            'Driver': 'Drivers'
        };
        activeFilterName.textContent = filterNames[filterType] || filterType;
    }
}

// Load farmers from Firebase
async function loadFarmers() {
    try {
        console.log('🔄 Loading farmers...');
        
        const farmersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'farmer'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(farmersQuery);
        farmers = [];
        
        querySnapshot.forEach((doc) => {
            const farmerData = doc.data();
            farmers.push({
                id: doc.id,
                ...farmerData,
                createdAt: farmerData.createdAt?.toDate() || new Date(),
                lastLogin: farmerData.lastLogin?.toDate() || null
            });
        });
        
        filteredFarmers = [...farmers];
        console.log(`📊 Loaded ${farmers.length} farmers`);
        
        // Render the table
        renderFarmersTable();
        
    } catch (error) {
        console.error('❌ Error loading farmers:', error);
        showFarmersError('Failed to load farmers');
    }
}

// Apply all filters (search, role, status)
function applyFilters() {
    const searchTerm = document.getElementById('farmerSearch')?.value?.toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    filteredFarmers = farmers.filter(farmer => {
        // Search filter
        const matchesSearch = !searchTerm || 
            (farmer.name && farmer.name.toLowerCase().includes(searchTerm)) ||
            (farmer.email && farmer.email.toLowerCase().includes(searchTerm)) ||
            (farmer.phone && farmer.phone.toLowerCase().includes(searchTerm));
        
        // Role filter
        const farmerType = farmer.farmerType || farmer.subRole || farmer.type || 'N/A';
        const matchesRole = roleFilter === 'all' || farmerType === roleFilter;
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || farmer.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    // Update active filters display
    updateActiveFiltersDisplay(searchTerm, roleFilter, statusFilter);
    
    currentFarmersPage = 1;
    renderFarmersTable();
}

// Update active filters display
function updateActiveFiltersDisplay(searchTerm, roleFilter, statusFilter) {
    const activeFiltersDisplay = document.getElementById('activeFiltersDisplay');
    if (!activeFiltersDisplay) return;
    
    const activeFilters = [];
    
    if (searchTerm) {
        activeFilters.push(`Search: "${searchTerm}"`);
    }
    if (roleFilter !== 'all') {
        activeFilters.push(`Role: ${roleFilter}`);
    }
    if (statusFilter !== 'all') {
        activeFilters.push(`Status: ${statusFilter}`);
    }
    
    activeFiltersDisplay.textContent = activeFilters.length > 0 ? activeFilters.join(', ') : 'None';
}

// Filter farmers by type (legacy function for backward compatibility)
function filterFarmers(filterType) {
    if (filterType === 'all') {
        filteredFarmers = [...farmers];
    } else {
        filteredFarmers = farmers.filter(farmer => {
            const farmerType = farmer.farmerType || farmer.subRole || farmer.type || 'N/A';
            return farmerType === filterType;
        });
    }
    
    currentFarmersPage = 1;
    renderFarmersTable();
}

// Render farmers table
function renderFarmersTable() {
    const tbody = document.getElementById('farmersTableBody');
    if (!tbody) return;
    
    const startIndex = (currentFarmersPage - 1) * farmersItemsPerPage;
    const endIndex = startIndex + farmersItemsPerPage;
    const pageFarmers = filteredFarmers.slice(startIndex, endIndex);
    
    tbody.innerHTML = '';
    
    if (pageFarmers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-10">
                    <div class="flex flex-col items-center justify-center text-center text-gray-500">
                        <i class="fas fa-seedling text-2xl mb-2 text-gray-400"></i>
                        <p>No farmers found</p>
                    </div>
                </td>
            </tr>
        `;
        updateFarmersPagination();
        return;
    }
    
    pageFarmers.forEach(farmer => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const statusClass = getFarmerStatusClass(farmer.status);
        const farmerType = farmer.farmerType || farmer.subRole || farmer.type || 'N/A';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-[var(--cane-400)] to-[var(--cane-500)] rounded-full flex items-center justify-center">
                        <i class="fas fa-seedling text-white text-sm"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${farmer.name || 'N/A'}</div>
                        <div class="text-sm text-gray-500">${farmer.email || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${farmerType}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${farmer.email || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                    ${farmer.status || 'inactive'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${formatLastLogin(farmer.lastLogin)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center space-x-2">
                    <button onclick="editFarmer('${farmer.id}')" class="text-[var(--cane-600)] hover:text-[var(--cane-700)]" title="Edit Farmer">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteFarmer('${farmer.id}')" class="text-red-600 hover:text-red-700" title="Delete Farmer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateFarmersPagination();
}

// Update farmers pagination
function updateFarmersPagination() {
    const total = filteredFarmers.length;
    const start = total === 0 ? 0 : (currentFarmersPage - 1) * farmersItemsPerPage + 1;
    const end = Math.min(currentFarmersPage * farmersItemsPerPage, total);
    
    const totalEl = document.getElementById('farmersTotal');
    const startEl = document.getElementById('farmersShowingStart');
    const endEl = document.getElementById('farmersShowingEnd');
    
    if (totalEl) totalEl.textContent = total;
    if (startEl) startEl.textContent = start;
    if (endEl) endEl.textContent = end;
}

// Get farmer status class for styling
function getFarmerStatusClass(status) {
    switch (status) {
        case 'active': return 'bg-green-100 text-green-800';
        case 'inactive': return 'bg-gray-100 text-gray-800';
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Format last login date
function formatLastLogin(lastLogin) {
    if (!lastLogin) return 'Never';
    
    const now = new Date();
    const loginDate = new Date(lastLogin);
    const diff = now - loginDate;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return loginDate.toLocaleDateString();
}

// Show farmers error message
function showFarmersError(message) {
    const tbody = document.getElementById('farmersTableBody');
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

// Edit farmer function
export function editFarmer(farmerId) {
    const farmer = farmers.find(f => f.id === farmerId);
    if (!farmer) {
        showFarmersAlert('Farmer not found', 'error');
        return;
    }
    
    // Open edit modal (assuming it exists in the main dashboard)
    if (window.openEditUserModal) {
        window.openEditUserModal(farmerId);
    } else {
        showFarmersAlert('Edit functionality not available', 'warning');
    }
}

// Delete farmer function
export async function deleteFarmer(farmerId) {
    if (!confirm('Are you sure you want to delete this farmer? This action cannot be undone.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'users', farmerId));
        showFarmersAlert('Farmer deleted successfully', 'success');
        loadFarmers();
        
    } catch (error) {
        console.error('❌ Error deleting farmer:', error);
        showFarmersAlert('Failed to delete farmer', 'error');
    }
}

// Update farmer status
export async function updateFarmerStatus(farmerId, newStatus) {
    try {
        await updateDoc(doc(db, 'users', farmerId), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        
        showFarmersAlert(`Farmer status updated to ${newStatus}`, 'success');
        loadFarmers();
        
    } catch (error) {
        console.error('❌ Error updating farmer status:', error);
        showFarmersAlert('Failed to update farmer status', 'error');
    }
}

// Refresh farmers data
export function refreshFarmers() {
    loadFarmers();
}

// Get farmers statistics
export function getFarmersStats() {
    const stats = {
        total: farmers.length,
        active: farmers.filter(f => f.status === 'active').length,
        inactive: farmers.filter(f => f.status === 'inactive').length,
        pending: farmers.filter(f => f.status === 'pending').length,
        byType: {
            'Field Handler': farmers.filter(f => (f.farmerType || f.subRole || f.type) === 'Field Handler').length,
            'Field Worker': farmers.filter(f => (f.farmerType || f.subRole || f.type) === 'Field Worker').length,
            'Driver': farmers.filter(f => (f.farmerType || f.subRole || f.type) === 'Driver').length
        }
    };
    
    return stats;
}

// Search farmers
export function searchFarmers(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        filteredFarmers = [...farmers];
    } else {
        const term = searchTerm.toLowerCase();
        filteredFarmers = farmers.filter(farmer => 
            (farmer.name && farmer.name.toLowerCase().includes(term)) ||
            (farmer.email && farmer.email.toLowerCase().includes(term)) ||
            (farmer.phone && farmer.phone.toLowerCase().includes(term))
        );
    }
    
    currentFarmersPage = 1;
    renderFarmersTable();
}

// Show farmers alert
function showFarmersAlert(message, type = 'success') {
    // Create alert element
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

// Export functions for global access
window.initializeFarmers = initializeFarmers;
window.editFarmer = editFarmer;
window.deleteFarmer = deleteFarmer;
window.updateFarmerStatus = updateFarmerStatus;
window.refreshFarmers = refreshFarmers;
window.getFarmersStats = getFarmersStats;
window.searchFarmers = searchFarmers;
