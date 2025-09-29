// Workers Dashboard JavaScript
// Global variables
let userType = 'worker';
let hasDriverBadge = false;
let currentSection = 'dashboard';

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setDisplayNameFromStorage();
    // Listen for cross-tab updates from profile-settings without reload
    window.addEventListener('storage', function(e) {
        if (e.key === 'farmerNickname' || e.key === 'farmerName') {
            setDisplayNameFromStorage();
        }
    });
    setupEventListeners();
});

function setDisplayNameFromStorage() {
    const nickname = localStorage.getItem('farmerNickname');
    const name = localStorage.getItem('farmerName') || 'Worker Name';
    const display = nickname && nickname.trim().length > 0 ? nickname : name;
    const nameEls = document.querySelectorAll('#userName, #dropdownUserName');
    nameEls.forEach(el => { if (el) el.textContent = display; });
}

// Initialize dashboard based on user type
function initializeDashboard() {
    // For now, set default values (you can integrate Firebase later)
    userType = 'worker';
    hasDriverBadge = false;
    
    // Update UI elements
    updateUserInterface();
    
    // Show/hide driver features based on badge status
    toggleDriverFeatures();
    
    // Initialize map
    initializeMap();
    
    // Initialize FullCalendar
    initializeCalendar();
}

// Update user interface elements
function updateUserInterface() {
    const badgeIndicator = document.getElementById('badgeIndicator');
    const dropdownUserType = document.getElementById('dropdownUserType');
    const sidebarUserType = document.getElementById('sidebarUserType');
    
    if (hasDriverBadge) {
        badgeIndicator.classList.remove('hidden');
        dropdownUserType.textContent = 'Worker with Driver Badge';
        if (sidebarUserType) {
            sidebarUserType.textContent = 'Worker (with badge)';
        }
    } else {
        badgeIndicator.classList.add('hidden');
        dropdownUserType.textContent = 'Worker';
        if (sidebarUserType) {
            sidebarUserType.textContent = 'Worker (no badge)';
        }
    }
}

// Toggle driver features based on badge status
function toggleDriverFeatures() {
    const driverFeatures = document.getElementById('driverFeatures');
    const driverMenuItems = document.getElementById('driverMenuItems');
    
    if (hasDriverBadge) {
        if (driverFeatures) driverFeatures.classList.remove('hidden');
        if (driverMenuItems) driverMenuItems.classList.remove('hidden');
    } else {
        if (driverFeatures) driverFeatures.classList.add('hidden');
        if (driverMenuItems) driverMenuItems.classList.add('hidden');
    }
}

// Initialize Leaflet map
function initializeMap() {
    try {
        const mapContainer = document.getElementById('fieldMap');
        if (!mapContainer) {
            console.log('Map container not found');
            return;
        }

        const map = L.map('fieldMap').setView([11.0064, 124.6075], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add a marker for Ormoc City
        L.marker([11.0064, 124.6075])
            .addTo(map)
            .bindPopup('<b>Ormoc City</b><br>Leyte, Philippines<br><small>SRA Ormoc Mill District</small>')
            .openPopup();

        // Add sample field markers
        const sampleFields = [
            { name: "Field 1", lat: 11.0064, lng: 124.6075 },
            { name: "Field 2", lat: 11.0164, lng: 124.6175 },
            { name: "Field 3", lat: 10.9964, lng: 124.5975 }
        ];

        sampleFields.forEach(field => {
            L.marker([field.lat, field.lng])
                .addTo(map)
                .bindPopup(`<b>${field.name}</b><br>Sugarcane Field`);
        });

        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        const mapContainer = document.getElementById('fieldMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="flex items-center justify-center h-full bg-red-50 text-red-600">
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p>Error loading map</p>
                        <p class="text-sm">${error.message}</p>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize FullCalendar
function initializeCalendar() {
    try {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) {
            console.log('Calendar container not found');
            return;
        }

        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth'
        });
        calendar.render();
        
        console.log('Calendar initialized successfully');
    } catch (error) {
        console.error('Error initializing calendar:', error);
    }
}

// Sidebar functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        }
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

// Navigation functionality
function showSection(sectionId) {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.remove('hidden');
    }
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('bg-[var(--cane-600)]', 'text-white');
        item.classList.add('text-gray-300');
    });
    
    const activeNavItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.remove('text-gray-300');
        activeNavItem.classList.add('bg-[var(--cane-600)]', 'text-white');
    }
    
    currentSection = sectionId;
}

// Profile dropdown functionality
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    
    const isVisible = dropdown.classList.contains('opacity-100');
    
    if (isVisible) {
        dropdown.classList.remove('opacity-100', 'visible', 'scale-100');
        dropdown.classList.add('opacity-0', 'invisible', 'scale-95');
    } else {
        dropdown.classList.remove('opacity-0', 'invisible', 'scale-95');
        dropdown.classList.add('opacity-100', 'visible', 'scale-100');
    }
}

// Navigation function for dashboard stats
function navigateToSection(section) {
    switch(section) {
        case 'fields':
            showSection('dashboard');
            console.log('Navigating to fields section');
            break;
        case 'assignments':
            showSection('schedule');
            console.log('Navigating to assignments/schedule section');
            break;
        case 'tasks':
            showSection('activity');
            console.log('Navigating to tasks/activity section');
            break;
        case 'joins':
            console.log('Navigating to pending joins section');
            break;
        default:
            console.log('Unknown section:', section);
    }
}

// Toggle notifications
function toggleNotifications() {
    console.log('Toggle notifications clicked');
    // You can implement notification panel logic here
    alert('Notifications feature will be implemented here');
}

// Logout function
function logout() {
    // Add your logout logic here
    alert('Logging out...');
                window.location.href = '../frontend/Common/lobby.html';
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleSidebar);
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
    
    // Navigation menu
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
            
            // Close sidebar on mobile after navigation
            if (window.innerWidth < 1024) {
                closeSidebar();
            }
        });
    });
    
    // Profile dropdown toggle
    const profileBtn = document.getElementById('profileDropdownBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', toggleProfileDropdown);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('profileDropdown');
        const profileBtn = document.getElementById('profileDropdownBtn');
        
        if (dropdown && profileBtn && !profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('opacity-100', 'visible', 'scale-100');
            dropdown.classList.add('opacity-0', 'invisible', 'scale-95');
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 1024) {
            closeSidebar();
        }
    });
}

// Export functions for use in HTML
window.navigateToSection = navigateToSection;
window.toggleNotifications = toggleNotifications;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showSection = showSection;
window.toggleProfileDropdown = toggleProfileDropdown;
