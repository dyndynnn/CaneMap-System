// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    getDoc, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    addDoc 
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

class ReportsManager {
    constructor() {
        this.currentUser = null;
        this.accessibleFields = [];
        this.costReports = [];
        this.productionReports = [];
        
        this.initAuthListener();
    }

    // Initialize authentication state listener
    initAuthListener() {
        try {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.currentUser = user;
                    this.loadAccessibleFields();
                    this.loadReports();
                } else {
                    this.currentUser = null;
                    this.accessibleFields = [];
                    this.costReports = [];
                    this.productionReports = [];
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

    // Get accessible fields for the current user
    async loadAccessibleFields() {
        try {
            if (!this.currentUser) return;

            const fieldsRef = collection(db, 'fields');
            
            // Query fields where user is owner or approved worker
            const fieldsQuery = query(
                fieldsRef,
                where('status', 'in', ['active', 'sra_reviewed'])
            );
            
            const fieldsSnapshot = await getDocs(fieldsQuery);
            const allFields = [];
            
            fieldsSnapshot.forEach((doc) => {
                const fieldData = doc.data();
                fieldData.id = doc.id;
                allFields.push(fieldData);
            });

            // Get field_workers collection to check user access
            const fieldWorkersRef = collection(db, 'field_workers');
            const fieldWorkersQuery = query(
                fieldWorkersRef,
                where('user_id', '==', this.currentUser.uid),
                where('status', '==', 'approved')
            );
            
            const fieldWorkersSnapshot = await getDocs(fieldWorkersQuery);
            const approvedFieldIds = new Set();
            
            fieldWorkersSnapshot.forEach((doc) => {
                const workerData = doc.data();
                approvedFieldIds.add(workerData.field_id);
            });

            // Filter fields based on user access
            this.accessibleFields = allFields.filter(field => {
                // User owns the field
                if (field.registered_by === this.currentUser.uid) {
                    return true;
                }
                
                // Check if user is approved worker
                if (approvedFieldIds.has(field.id)) {
                    return true;
                }
                
                return false;
            });

            // Sort by field name
            this.accessibleFields.sort((a, b) => a.field_name.localeCompare(b.field_name));
            
            this.updateFieldsDropdowns();
        } catch (error) {
            console.error('Error loading accessible fields:', error);
        }
    }

    // Update field dropdowns in the UI
    updateFieldsDropdowns() {
        try {
            const costFieldSelect = document.getElementById('cost_field_id');
            const productionFieldSelect = document.getElementById('production_field_id');
            
            if (costFieldSelect && productionFieldSelect) {
                // Clear existing options
                costFieldSelect.innerHTML = '<option value="">Select a field</option>';
                productionFieldSelect.innerHTML = '<option value="">Select a field</option>';
                
                if (this.accessibleFields.length === 0) {
                    const noFieldsOption = document.createElement('option');
                    noFieldsOption.value = "";
                    noFieldsOption.textContent = "No accessible fields found";
                    noFieldsOption.disabled = true;
                    
                    costFieldSelect.appendChild(noFieldsOption.cloneNode(true));
                    productionFieldSelect.appendChild(noFieldsOption);
                } else {
                    // Add field options
                    this.accessibleFields.forEach(field => {
                        const option = document.createElement('option');
                        option.value = field.id;
                        option.textContent = `${field.field_name} (${field.barangay})`;
                        
                        costFieldSelect.appendChild(option.cloneNode(true));
                        productionFieldSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error updating field dropdowns:', error);
        }
    }

    // Load user's reports
    async loadReports() {
        if (!this.currentUser) return;
        
        await Promise.all([
            this.loadCostReports(),
            this.loadProductionReports()
        ]);
        
        this.updateReportsDisplay();
    }

    // Load cost reports
    async loadCostReports() {
        try {
            const costReportsRef = collection(db, 'cost_reports');
            const costReportsQuery = query(
                costReportsRef,
                where('user_id', '==', this.currentUser.uid),
                orderBy('submitted_at', 'desc')
            );
            
            const snapshot = await getDocs(costReportsQuery);
            this.costReports = [];
            
            snapshot.forEach((doc) => {
                const reportData = doc.data();
                reportData.id = doc.id;
                this.costReports.push(reportData);
            });
        } catch (error) {
            console.error('Error loading cost reports:', error);
        }
    }

    // Load production reports
    async loadProductionReports() {
        try {
            const productionReportsRef = collection(db, 'production_reports');
            const productionReportsQuery = query(
                productionReportsRef,
                where('user_id', '==', this.currentUser.uid),
                orderBy('submitted_at', 'desc')
            );
            
            const snapshot = await getDocs(productionReportsQuery);
            this.productionReports = [];
            
            snapshot.forEach((doc) => {
                const reportData = doc.data();
                reportData.id = doc.id;
                this.productionReports.push(reportData);
            });
        } catch (error) {
            console.error('Error loading production reports:', error);
        }
    }

    // Update reports display in the UI
    updateReportsDisplay() {
        this.updateCostReportsDisplay();
        this.updateProductionReportsDisplay();
    }

    // Update cost reports display
    updateCostReportsDisplay() {
        const costReportsContainer = document.getElementById('cost-reports-container');
        if (!costReportsContainer) return;

        if (this.costReports.length === 0) {
            costReportsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No cost reports submitted yet.</p>';
            return;
        }

        const reportsHTML = this.costReports.map(report => `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold text-gray-900">${this.escapeHtml(report.field_name || 'Unknown Field')}</h4>
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full status-${report.status || 'pending'}">
                        ${this.formatStatus(report.status || 'pending')}
                    </span>
                </div>
                <p class="text-sm text-gray-600">Period: ${this.escapeHtml(report.report_period)}</p>
                <p class="text-sm text-gray-600">Total Cost: ₱${this.formatNumber(report.total_cost)}</p>
                <p class="text-sm text-gray-600">Submitted: ${this.formatDate(report.submitted_at)}</p>
                
                ${report.summary_file_path ? `
                    <div class="mt-2">
                        <a href="${report.summary_file_path}" target="_blank" 
                           class="text-blue-600 hover:text-blue-800 text-sm">
                            View Summary Document →
                        </a>
                    </div>
                ` : ''}
            </div>
        `).join('');

        costReportsContainer.innerHTML = reportsHTML;
    }

    // Update production reports display
    updateProductionReportsDisplay() {
        const productionReportsContainer = document.getElementById('production-reports-container');
        if (!productionReportsContainer) return;

        if (this.productionReports.length === 0) {
            productionReportsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No production reports submitted yet.</p>';
            return;
        }

        const reportsHTML = this.productionReports.map(report => `
            <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold text-gray-900">${this.escapeHtml(report.field_name || 'Unknown Field')}</h4>
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full status-${report.status || 'pending'}">
                        ${this.formatStatus(report.status || 'pending')}
                    </span>
                </div>
                <p class="text-sm text-gray-600">Harvest Date: ${this.formatDate(report.harvest_date)}</p>
                <p class="text-sm text-gray-600">Area: ${report.area_harvested} hectares</p>
                <p class="text-sm text-gray-600">Yield: ${this.formatNumber(report.total_yield)} kg</p>
                <p class="text-sm text-gray-600">Submitted: ${this.formatDate(report.submitted_at)}</p>
                
                ${report.harvest_proof_path ? `
                    <div class="mt-2">
                        <a href="${report.harvest_proof_path}" target="_blank" 
                           class="text-blue-600 hover:text-blue-800 text-sm">
                            View Harvest Proof →
                        </a>
                    </div>
                ` : ''}
            </div>
        `).join('');

        productionReportsContainer.innerHTML = reportsHTML;
    }

    // Submit cost report
    async submitCostReport(formData) {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            const fieldId = formData.get('field_id');
            const reportPeriod = formData.get('report_period');
            const fertilizerCost = parseFloat(formData.get('fertilizer_cost')) || 0;
            const laborCost = parseFloat(formData.get('labor_cost')) || 0;
            const equipmentCost = parseFloat(formData.get('equipment_cost')) || 0;
            const otherCosts = parseFloat(formData.get('other_costs')) || 0;
            const totalCost = fertilizerCost + laborCost + equipmentCost + otherCosts;

            // Validate required fields
            if (!fieldId || !reportPeriod) {
                throw new Error('Please fill in all required fields.');
            }

            // Check field access
            const fieldAccess = this.accessibleFields.find(field => field.id === fieldId);
            if (!fieldAccess) {
                throw new Error('You don\'t have access to this field.');
            }

            let summaryFilePath = '';
            const summaryFile = formData.get('summary_file');

            // Handle file upload if provided
            if (summaryFile && summaryFile.size > 0) {
                summaryFilePath = await this.uploadFile(summaryFile, 'cost_reports');
            }

            // Create cost report document
            const costReportData = {
                field_id: fieldId,
                user_id: this.currentUser.uid,
                report_period: reportPeriod,
                fertilizer_cost: fertilizerCost,
                labor_cost: laborCost,
                equipment_cost: equipmentCost,
                other_costs: otherCosts,
                total_cost: totalCost,
                summary_file_path: summaryFilePath,
                field_name: fieldAccess.field_name,
                barangay: fieldAccess.barangay,
                status: 'pending',
                submitted_at: serverTimestamp()
            };

            // Add to Firestore
            const costReportsRef = collection(db, 'cost_reports');
            await addDoc(costReportsRef, costReportData);

            // Reload reports
            await this.loadReports();

            return { success: true, message: 'Cost report submitted successfully! It will be reviewed by SRA officers.' };
        } catch (error) {
            console.error('Error submitting cost report:', error);
            return { success: false, message: error.message || 'Error submitting report. Please try again.' };
        }
    }

    // Submit production report
    async submitProductionReport(formData) {
        try {
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }

            const fieldId = formData.get('field_id');
            const areaHarvested = parseFloat(formData.get('area_harvested'));
            const totalYield = parseFloat(formData.get('total_yield'));
            const harvestDate = formData.get('harvest_date');
            const sugarcaneVariety = formData.get('sugarcane_variety');

            // Validate required fields
            if (!fieldId || !areaHarvested || !totalYield || !harvestDate) {
                throw new Error('Please fill in all required fields.');
            }

            // Check field access
            const fieldAccess = this.accessibleFields.find(field => field.id === fieldId);
            if (!fieldAccess) {
                throw new Error('You don\'t have access to this field.');
            }

            let harvestProofPath = '';
            const harvestProofFile = formData.get('harvest_proof');

            // Handle file upload if provided
            if (harvestProofFile && harvestProofFile.size > 0) {
                harvestProofPath = await this.uploadFile(harvestProofFile, 'production_reports');
            }

            // Create production report document
            const productionReportData = {
                field_id: fieldId,
                user_id: this.currentUser.uid,
                area_harvested: areaHarvested,
                total_yield: totalYield,
                harvest_date: harvestDate,
                sugarcane_variety: sugarcaneVariety,
                harvest_proof_path: harvestProofPath,
                field_name: fieldAccess.field_name,
                barangay: fieldAccess.barangay,
                status: 'pending',
                submitted_at: serverTimestamp()
            };

            // Add to Firestore
            const productionReportsRef = collection(db, 'production_reports');
            await addDoc(productionReportsRef, productionReportData);

            // Reload reports
            await this.loadReports();

            return { success: true, message: 'Production report submitted successfully! It will be reviewed by SRA officers.' };
        } catch (error) {
            console.error('Error submitting production report:', error);
            return { success: false, message: error.message || 'Error submitting report. Please try again.' };
        }
    }

    // Upload file to Firebase Storage
    async uploadFile(file, folder) {
        try {
            const timestamp = Date.now();
            const fileName = `${folder}_${timestamp}_${this.currentUser.uid}_${file.name}`;
            const storageRef = ref(storage, `${folder}/${fileName}`);
            
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw new Error('Failed to upload file. Please try again.');
        }
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatStatus(status) {
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatNumber(num) {
        return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                year: 'numeric'
            });
        }
        
        return 'N/A';
    }
}

// Export for use in HTML
window.ReportsManager = ReportsManager;
