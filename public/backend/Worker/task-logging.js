// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAWcIMy6hBF4aP6LTSS1PwtmZogUebAI4A",
    authDomain: "canemap-system.firebaseapp.com",
    projectId: "canemap-system",
    storageBucket: "canemap-system.firebasestorage.app",
    messagingSenderId: "624993566775",
    appId: "1:624993566775:web:5b1b72cb58203b46123fb2",
    measurementId: "G-08KFJQ1NEJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

class TaskLoggingManager {
    constructor() {
        this.currentUser = null;
        this.fieldData = null;
        this.taskLogs = [];
        this.fieldId = null;
        
        this.initAuthListener();
    }

    // Initialize authentication state listener
    initAuthListener() {
        try {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.currentUser = user;
                    this.loadFieldData();
                } else {
                    this.currentUser = null;
                    this.fieldData = null;
                    this.taskLogs = [];
                    // Redirect to login if not authenticated
                    window.location.href = '../frontend/Handler/farmers_login.html';
                }
            });
        } catch (error) {
            console.error('Error initializing auth listener:', error);
            // Fallback redirect
            window.location.href = '../frontend/Handler/farmers_login.html';
        }
    }

    // Get field ID from URL parameters
    getFieldIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        this.fieldId = urlParams.get('field_id');
        
        if (!this.fieldId) {
            this.showMessage('No field ID specified. Redirecting to lobby...', 'error');
            setTimeout(() => {
                window.location.href = '../frontend/Common/lobby.html';
            }, 2000);
            return false;
        }
        
        return true;
    }

    // Load field data and verify user access
    async loadFieldData() {
        try {
            if (!this.getFieldIdFromUrl()) return;
            
            // Get field document
            const fieldRef = doc(db, 'fields', this.fieldId);
            const fieldSnap = await getDoc(fieldRef);
            
            if (!fieldSnap.exists()) {
                            this.showMessage('Field not found. Redirecting to lobby...', 'error');
            setTimeout(() => {
                window.location.href = '../frontend/Common/lobby.html';
            }, 2000);
                return;
            }
            
            const fieldData = fieldSnap.data();
            fieldData.id = fieldSnap.id;
            
            // Check if user has access to this field
            const hasAccess = await this.verifyFieldAccess(fieldData);
            
            if (!hasAccess) {
                this.showMessage('You do not have access to this field. Redirecting to lobby...', 'error');
                setTimeout(() => {
                    window.location.href = '../frontend/Common/lobby.html';
                }, 2000);
                return;
            }
            
            this.fieldData = fieldData;
            this.updateFieldDisplay();
            this.loadTaskLogs();
            this.initializeMap();
            
        } catch (error) {
            console.error('Error loading field data:', error);
            this.showMessage('Error loading field data. Please try again.', 'error');
        }
    }

    // Verify if user has access to the field
    async verifyFieldAccess(fieldData) {
        try {
            // User owns the field
            if (fieldData.registered_by === this.currentUser.uid) {
                return true;
            }
            
            // Check if user is approved worker
            const fieldWorkersRef = collection(db, 'field_workers');
            const fieldWorkersQuery = query(
                fieldWorkersRef,
                where('field_id', '==', this.fieldId),
                where('user_id', '==', this.currentUser.uid),
                where('status', '==', 'approved')
            );
            
            const fieldWorkersSnapshot = await getDocs(fieldWorkersQuery);
            return !fieldWorkersSnapshot.empty;
            
        } catch (error) {
            console.error('Error verifying field access:', error);
            return false;
        }
    }

    // Update field information display
    updateFieldDisplay() {
        const fieldNameElement = document.getElementById('field-name');
        const fieldLocationElement = document.getElementById('field-location');
        const fieldOwnerElement = document.getElementById('field-owner');
        
        if (fieldNameElement && this.fieldData) {
            fieldNameElement.textContent = this.fieldData.field_name || 'Unknown Field';
        }
        
        if (fieldLocationElement && this.fieldData) {
            const barangay = this.fieldData.barangay || 'Unknown';
            const municipality = this.fieldData.municipality || 'Unknown';
            fieldLocationElement.textContent = `${barangay}, ${municipality}`;
        }
        
        if (fieldOwnerElement && this.fieldData) {
            // Get owner name from users collection
            this.getUserName(this.fieldData.registered_by).then(ownerName => {
                fieldOwnerElement.textContent = ownerName || 'Unknown Owner';
            });
        }
    }

    // Get user name from users collection
    async getUserName(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                return userSnap.data().full_name || 'Unknown User';
            }
            
            return 'Unknown User';
        } catch (error) {
            console.error('Error getting user name:', error);
            return 'Unknown User';
        }
    }

    // Load task logs for the field
    async loadTaskLogs() {
        try {
            const taskLogsRef = collection(db, 'task_logs');
            const taskLogsQuery = query(
                taskLogsRef,
                where('field_id', '==', this.fieldId),
                orderBy('logged_at', 'desc')
            );
            
            const snapshot = await getDocs(taskLogsQuery);
            this.taskLogs = [];
            
            snapshot.forEach((doc) => {
                const logData = doc.data();
                logData.id = doc.id;
                this.taskLogs.push(logData);
            });
            
            this.updateTaskLogsDisplay();
            
        } catch (error) {
            console.error('Error loading task logs:', error);
            this.showMessage('Error loading task logs. Please try again.', 'error');
        }
    }

    // Update task logs display in the UI
    updateTaskLogsDisplay() {
        const taskLogsContainer = document.getElementById('task-logs-container');
        if (!taskLogsContainer) return;

        if (this.taskLogs.length === 0) {
            taskLogsContainer.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-gray-400 mb-4">
                        <i data-lucide="clipboard-list" class="w-12 h-12 mx-auto"></i>
                    </div>
                    <p class="text-gray-500">No tasks logged yet.</p>
                </div>
            `;
            return;
        }

        const logsHTML = this.taskLogs.map(log => `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold text-gray-900">${this.escapeHtml(log.task_name || 'Unknown Task')}</h4>
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full task-${log.task_status || 'done'}">
                        ${this.formatTaskStatus(log.task_status || 'done')}
                    </span>
                </div>
                
                ${log.description ? `
                    <p class="text-sm text-gray-600 mb-2">${this.escapeHtml(log.description)}</p>
                ` : ''}
                
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>By: ${this.escapeHtml(log.worker_name || 'Unknown Worker')}</span>
                    <span>${this.formatDate(log.logged_at)}</span>
                </div>
                
                ${(log.selfie_path || log.field_photo_path) ? `
                    <div class="mt-3 flex space-x-2">
                        ${log.selfie_path ? `
                            <a href="${log.selfie_path}" target="_blank" class="text-blue-600 hover:text-blue-800 text-xs">
                                View Selfie
                            </a>
                        ` : ''}
                        ${log.field_photo_path ? `
                            <a href="${log.field_photo_path}" target="_blank" class="text-blue-600 hover:text-blue-800 text-xs">
                                View Field Photo
                            </a>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');

        taskLogsContainer.innerHTML = logsHTML;
        
        // Reinitialize Lucide icons for new content
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // Submit new task log
    async submitTaskLog(formData) {
        try {
            if (!this.currentUser || !this.fieldData) {
                throw new Error('User not authenticated or field not loaded');
            }

            const taskName = formData.get('task_name');
            const description = formData.get('description');
            const taskStatus = formData.get('task_status');

            // Validate required fields
            if (!taskName || !taskStatus) {
                throw new Error('Please fill in all required fields.');
            }

            // Handle file uploads
            let selfiePath = '';
            let fieldPhotoPath = '';

            const selfieFile = formData.get('selfie');
            const fieldPhotoFile = formData.get('field_photo');

            // Upload selfie if provided
            if (selfieFile && selfieFile.size > 0) {
                selfiePath = await this.uploadFile(selfieFile, 'selfie');
            }

            // Upload field photo if provided
            if (fieldPhotoFile && fieldPhotoFile.size > 0) {
                fieldPhotoPath = await this.uploadFile(fieldPhotoFile, 'field_photo');
            }

            // Get current user's name
            const workerName = await this.getUserName(this.currentUser.uid);

            // Create task log document
            const taskLogData = {
                field_id: this.fieldId,
                user_id: this.currentUser.uid,
                task_name: taskName,
                description: description || '',
                task_status: taskStatus,
                selfie_path: selfiePath,
                field_photo_path: fieldPhotoPath,
                worker_name: workerName,
                field_name: this.fieldData.field_name,
                logged_at: serverTimestamp()
            };

            // Add to Firestore
            const taskLogsRef = collection(db, 'task_logs');
            await addDoc(taskLogsRef, taskLogData);

            // Reload task logs
            await this.loadTaskLogs();

            return { success: true, message: 'Task logged successfully!' };
        } catch (error) {
            console.error('Error submitting task log:', error);
            return { success: false, message: error.message || 'Error logging task. Please try again.' };
        }
    }

    // Upload file to Firebase Storage
    async uploadFile(file, type) {
        try {
            const timestamp = Date.now();
            const fileName = `${type}_${timestamp}_${this.currentUser.uid}_${file.name}`;
            const storageRef = ref(storage, `task_photos/${fileName}`);
            
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw new Error('Failed to upload file. Please try again.');
        }
    }

    // Initialize map with field location
    initializeMap() {
        try {
            if (!this.fieldData) return;

            const latitude = this.fieldData.latitude || 14.5995; // Default to Philippines
            const longitude = this.fieldData.longitude || 120.9842;

            // Initialize map
            const fieldMap = L.map('fieldMap').setView([latitude, longitude], 15);

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(fieldMap);

            // Add field marker
            const fieldMarker = L.marker([latitude, longitude])
                .addTo(fieldMap)
                .bindPopup(`
                    <div class="field-popup">
                        <h4 class="font-semibold text-gray-900">${this.escapeHtml(this.fieldData.field_name || 'Unknown Field')}</h4>
                        <p class="text-sm text-gray-600">${this.escapeHtml(this.fieldData.barangay || 'Unknown')}, ${this.escapeHtml(this.fieldData.municipality || 'Unknown')}</p>
                        <p class="text-sm text-gray-600">Area: ${this.fieldData.area_size || 'Unknown'} hectares</p>
                        <p class="text-sm text-gray-600">Owner: ${this.escapeHtml(this.fieldData.owner_name || 'Unknown Owner')}</p>
                    </div>
                `);

        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }

    // Show message (success or error)
    showMessage(message, type) {
        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `px-4 py-3 rounded-lg mb-6 ${
            type === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700' 
                : 'bg-green-50 border border-green-200 text-green-700'
        }`;
        messageDiv.textContent = message;

        messageContainer.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTaskStatus(status) {
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDate(date) {
        if (!date) return 'N/A';
        
        if (date.toDate) {
            // Firestore timestamp
            return date.toDate().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });
        } else if (typeof date === 'string') {
            // String date
            return new Date(date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });
        }
        
        return 'N/A';
    }
}

// Export for use in HTML
window.TaskLoggingManager = TaskLoggingManager;
