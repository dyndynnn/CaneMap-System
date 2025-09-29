// Join Field functionality
class JoinFieldManager {
    constructor() {
        this.currentUser = null;
        this.availableFields = [];
        this.pendingRequests = [];
        this.fieldsMap = null;
        
        this.init();
    }

    async init() {
        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadData();
                this.renderUI();
            } else {
                // Redirect to login if not authenticated
                window.location.href = '../frontend/Handler/farmers_login.html';
            }
        });
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadAvailableFields(),
                this.loadPendingRequests()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showMessage('Error loading data. Please try again.', 'error');
        }
    }

    async loadAvailableFields() {
        const fieldsRef = collection(db, 'fields');
        const fieldsQuery = query(
            fieldsRef,
            where('status', 'in', ['active', 'sra_reviewed']),
            orderBy('created_at', 'desc')
        );
        
        const snapshot = await getDocs(fieldsQuery);
        this.availableFields = [];
        
        for (const doc of snapshot.docs) {
            const fieldData = doc.data();
            // Filter out fields owned by current user
            if (fieldData.owner_uid !== this.currentUser.uid) {
                this.availableFields.push({
                    id: doc.id,
                    ...fieldData
                });
            }
        }
    }

    async loadPendingRequests() {
        const fieldWorkersRef = collection(db, 'field_workers');
        const requestsQuery = query(
            fieldWorkersRef,
            where('user_uid', '==', this.currentUser.uid),
            orderBy('requested_at', 'desc')
        );
        
        const snapshot = await getDocs(requestsQuery);
        this.pendingRequests = [];
        
        for (const docSnapshot of snapshot.docs) {
            const requestData = docSnapshot.data();
            // Get field details for each request
            const fieldDoc = await getDoc(doc(db, 'fields', requestData.field_id));
            if (fieldDoc.exists()) {
                const fieldData = fieldDoc.data();
                this.pendingRequests.push({
                    id: docSnapshot.id,
                    ...requestData,
                    field: fieldData
                });
            }
        }
    }

    async submitJoinRequest(fieldId) {
        try {
            // Check if already requested
            const fieldWorkersRef = collection(db, 'field_workers');
            const checkQuery = query(
                fieldWorkersRef,
                where('field_id', '==', fieldId),
                where('user_uid', '==', this.currentUser.uid)
            );
            
            const checkSnapshot = await getDocs(checkQuery);
            if (!checkSnapshot.empty) {
                this.showMessage('You have already requested to join this field.', 'error');
                return;
            }

            // Create join request
            const newRequestRef = doc(collection(db, 'field_workers'));
            await setDoc(newRequestRef, {
                field_id: fieldId,
                user_uid: this.currentUser.uid,
                status: 'pending',
                requested_at: serverTimestamp()
            });

            this.showMessage('Join request submitted successfully! The field owner will be notified.', 'success');
            await this.loadData();
            this.renderUI();
        } catch (error) {
            console.error('Error submitting request:', error);
            this.showMessage('Error submitting request. Please try again.', 'error');
        }
    }

    showMessage(message, type) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        const alertClass = type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700';
        
        messageContainer.innerHTML = `
            <div class="border px-4 py-3 rounded-lg mb-6 ${alertClass}">
                ${message}
            </div>
        `;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageContainer.innerHTML = '';
        }, 5000);
    }

    renderUI() {
        this.renderAvailableFields();
        this.renderPendingRequests();
        this.initMap();
    }

    renderAvailableFields() {
        const container = document.getElementById('available-fields');
        if (!container) return;

        if (this.availableFields.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <div class="text-gray-400 mb-4">
                        <i data-lucide="map-pin" class="w-12 h-12 mx-auto"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">No Fields Available</h3>
                    <p class="text-gray-600 mb-4">There are currently no active fields available to join.</p>
                    <a href="register-field.html" class="btn-primary px-4 py-2 rounded-md text-sm">Register Your Own Field</a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${this.availableFields.map(field => this.renderFieldCard(field)).join('')}
                </div>
            `;
        }

        // Re-initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    renderFieldCard(field) {
        const statusClass = this.getStatusClass(field.status);
        const statusText = field.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="font-semibold text-gray-900">${this.escapeHtml(field.field_name)}</h3>
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                    
                    <div class="space-y-2 text-sm text-gray-600 mb-4">
                        <p><i data-lucide="map-pin" class="w-4 h-4 inline mr-2"></i>${this.escapeHtml(field.barangay)}, ${this.escapeHtml(field.municipality)}</p>
                        <p><i data-lucide="maximize" class="w-4 h-4 inline mr-2"></i>${field.area_size} hectares</p>
                        <p><i data-lucide="user" class="w-4 h-4 inline mr-2"></i>Owner: ${this.escapeHtml(field.owner_name || 'Unknown')}</p>
                        ${field.crop_variety ? `<p><i data-lucide="leaf" class="w-4 h-4 inline mr-2"></i>${this.escapeHtml(field.crop_variety)}</p>` : ''}
                    </div>
                    
                    <button onclick="joinFieldManager.submitJoinRequest('${field.id}')" class="w-full btn-primary py-2 px-4 rounded-md text-sm">
                        Request to Join
                    </button>
                </div>
            </div>
        `;
    }

    renderPendingRequests() {
        const container = document.getElementById('pending-requests');
        if (!container) return;

        if (this.pendingRequests.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border">
                <div class="p-6">
                    <div class="space-y-4">
                        ${this.pendingRequests.map(request => this.renderRequestItem(request)).join('')}
                    </div>
                </div>
            </div>
        `;

        // Re-initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    renderRequestItem(request) {
        const statusClass = this.getStatusClass(request.status);
        const statusText = request.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const requestedDate = request.requested_at ? this.formatDate(request.requested_at.toDate()) : 'Unknown';
        
        let actionHtml = '';
        if (request.status === 'approved') {
            actionHtml = `
                <div class="mt-3">
                    <a href="task-logging.html?field_id=${request.field_id}" class="text-sm text-green-600 hover:text-green-800">
                        Start Logging Tasks →
                    </a>
                </div>
            `;
        } else if (request.status === 'rejected') {
            actionHtml = `
                <div class="mt-3">
                    <p class="text-sm text-red-600">Your request was not approved</p>
                </div>
            `;
        } else {
            actionHtml = `
                <div class="mt-3">
                    <p class="text-sm text-gray-600">Waiting for field owner approval</p>
                </div>
            `;
        }

        return `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-semibold text-gray-900">${this.escapeHtml(request.field.field_name)}</h4>
                        <p class="text-sm text-gray-600">${this.escapeHtml(request.field.barangay)}, ${this.escapeHtml(request.field.municipality)}</p>
                        <p class="text-sm text-gray-600">Requested: ${requestedDate}</p>
                    </div>
                    <div class="text-right">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
                ${actionHtml}
            </div>
        `;
    }

    initMap() {
        const mapContainer = document.getElementById('fieldsMap');
        if (!mapContainer || this.fieldsMap) return;

        // Initialize Leaflet map
        this.fieldsMap = L.map('fieldsMap').setView([14.5995, 120.9842], 10);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.fieldsMap);

        // Add field markers
        this.availableFields.forEach(field => {
            if (field.latitude && field.longitude) {
                const statusText = field.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                const statusClass = this.getStatusClass(field.status);
                
                const marker = L.marker([field.latitude, field.longitude])
                    .addTo(this.fieldsMap)
                    .bindPopup(`
                        <div class="field-popup">
                            <h4 class="font-semibold text-gray-900">${this.escapeHtml(field.field_name)}</h4>
                            <p class="text-sm text-gray-600">${this.escapeHtml(field.barangay)}, ${this.escapeHtml(field.municipality)}</p>
                            <p class="text-sm text-gray-600">Area: ${field.area_size} hectares</p>
                            <p class="text-sm text-gray-600">Owner: ${this.escapeHtml(field.owner_name || 'Unknown')}</p>
                            <p class="text-sm text-gray-600">Status: ${statusText}</p>
                            <button onclick="joinFieldManager.submitJoinRequest('${field.id}')" class="text-blue-600 hover:text-blue-800 text-sm mt-2">
                                Request to Join
                            </button>
                        </div>
                    `);
            }
        });
    }

    getStatusClass(status) {
        const statusClasses = {
            'active': 'bg-green-100 text-green-800',
            'sra_reviewed': 'bg-blue-100 text-blue-800',
            'pending': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-green-100 text-green-800',
            'rejected': 'bg-red-100 text-red-800'
        };
        return statusClasses[status] || 'bg-gray-100 text-gray-800';
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Initialize join field manager
    window.joinFieldManager = new JoinFieldManager();
});
