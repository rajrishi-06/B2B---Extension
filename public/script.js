
// Import the createClient function from your *local* supabase.js bundle
import { createClient } from './supabase.js';

// --- SUPABASE SETUP ---
let supabaseClient; 

import { Analytics } from "@vercel/analytics/next"

// --- INLINE ICONS ---
// Using inline SVGs is cleaner than another CDN request
const ICONS = {
    edit: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
    save: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`,
    cancel: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
};

// --- CONSTANTS ---
const ROWS_PER_PAGE = 10;
const REQUIRED_COLUMNS = ['POC Name', 'Email ID', 'LinkedIn profile']; // Adjust as needed
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- APPLICATION STATE ---
const state = {
    isUploading: false,
    hasHeader: true,
    rows: [], // The master list of row data objects
    allHeaders: [],
    shownRows: 0,
    currentPage: 1,
    currentFilter: 'all',
    uploadStats: {
        total: 0,
        success: 0,
        skipped: 0,
        failed: 0
    }
};

// --- DOM ELEMENTS ---
const dom = {
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    pasteArea: document.getElementById('paste-area'),
    headerToggle: document.getElementById('header-toggle'),
    uploadCard: document.getElementById('upload-card'),
    previewCard: document.getElementById('preview-card'),
    progressCard: document.getElementById('progress-card'),
    logCard: document.getElementById('log-card'),
    previewHeader: document.getElementById('preview-header'),
    previewBody: document.getElementById('preview-body'),
    previewCount: document.getElementById('preview-count'),
    selectAllCheckbox: document.getElementById('select-all-checkbox'),
    selectAllValidBtn: document.getElementById('select-all-valid-btn'),
    deselectAllBtn: document.getElementById('deselect-all-btn'),
    uploadBtn: document.getElementById('upload-btn'),
    uploadCount: document.getElementById('upload-count'),

    paginationControls: document.getElementById('pagination-controls'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    prevPageBtnMobile: document.getElementById('prev-page-btn-mobile'),
    nextPageBtnMobile: document.getElementById('next-page-btn-mobile'),
    paginationStart: document.getElementById('pagination-start'),
    paginationEnd: document.getElementById('pagination-end'),
    paginationTotal: document.getElementById('pagination-total'),
    paginationCurrent: document.getElementById('pagination-current'),
    paginationTotalPages: document.getElementById('pagination-total-pages'),

    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    statSuccess: document.getElementById('stat-success'),
    statSkipped: document.getElementById('stat-skipped'),
    statFailed: document.getElementById('stat-failed'),
    logContainer: document.getElementById('log-container'),
    downloadErrorsBtn: document.getElementById('download-errors-btn'),
    filterDropdown: document.getElementById('filter-dropdown'), // <-- ADD THIS
    clearLogsBtn: document.getElementById('clear-logs-btn'),
    helpBtn: document.getElementById('help-btn'),
    helpModal: document.getElementById('help-modal'),
    closeHelpModal: document.getElementById('close-help-modal'),
    downloadSampleBtn: document.getElementById('download-sample-btn'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmCount: document.getElementById('confirm-count'),
    confirmUploadBtn: document.getElementById('confirm-upload-btn'),
    cancelUploadBtn: document.getElementById('cancel-upload-btn'),
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    iconSun: document.getElementById('icon-sun'),
    iconMoon: document.getElementById('icon-moon')
};

// --- UTILITY FUNCTIONS ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function validateEmail(email) {
    if (!email) return false; // Handle empty/null
    return EMAIL_REGEX.test(String(email).toLowerCase());
}

function log(message, type = 'info') {
    const colors = {
        info: 'text-gray-500 dark:text-gray-400',
        success: 'text-green-600 dark:text-green-400',
        warn: 'text-yellow-600 dark:text-yellow-400',
        error: 'text-red-600 dark:text-red-400'
    };
    const p = document.createElement('p');
    p.className = `flex items-start ${colors[type]}`;
    p.innerHTML = `<span class="flex-shrink-0 w-4 h-5 text-center">${
        type === 'success' ? '✓' : 
        type === 'warn' ? '!' : 
        type === 'error' ? '✗' : 
        '›'
    }</span><span class="ml-2">${message}</span>`;
    
    const firstLog = dom.logContainer.querySelector('p');
    if (firstLog && firstLog.textContent === 'Waiting for data...') {
        dom.logContainer.innerHTML = '';
    }
    dom.logContainer.appendChild(p);
    dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
}

function clearLogs() {
    dom.logContainer.innerHTML = '<p class="text-gray-400 italic">Logs cleared.</p>';
}

function getFilteredRows() {
    if (state.currentFilter === 'all') {
        return state.rows;
    }
    return state.rows.filter(r => r.status === state.currentFilter);
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- DARK MODE ---
function setDarkMode(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        dom.iconSun.classList.add('hidden');
        dom.iconMoon.classList.remove('hidden');
        localStorage.theme = 'dark';
    } else {
        document.documentElement.classList.remove('dark');
        dom.iconSun.classList.remove('hidden');
        dom.iconMoon.classList.add('hidden');
        localStorage.theme = 'light';
    }
}

dom.darkModeToggle.addEventListener('click', () => {
    setDarkMode(!document.documentElement.classList.contains('dark'));
});

// --- MAIN LOGIC ---

/**
 * Entry point for file/paste.
 * Resets state and starts the parsing process.
 */
function handleDataInput(input) {
    log('New data detected. Resetting state and parsing...');
    
    // Reset state
    state.rows = [];
    state.allHeaders = [];
    state.shownRows = 0;
    state.isUploading = false;
    
    // Reset UI
    dom.previewCard.style.display = 'block';
    dom.progressCard.style.display = 'none';
    dom.logCard.style.display = 'block';
    dom.uploadCard.style.opacity = '0.5';
    dom.uploadBtn.disabled = true;
    dom.downloadErrorsBtn.disabled = true;
    clearLogs();
    
    // Start parsing
    parseCsv(input);
}

/**
 * Step 1: Parse CSV data using PapaParse
 */
function parseCsv(input) {
    Papa.parse(input, {
        header: state.hasHeader,
        skipEmptyLines: true,
        transformHeader: header => header.trim(),
        transform: value => value.trim(), // Trim all values!
        complete: (results) => {
            if (results.errors.length) {
                results.errors.forEach(err => {
                    log(`Parsing Error: ${err.message} on row ${err.row}`, 'error');
                });
                dom.uploadCard.style.opacity = '1';
                return;
            }
            
            log(`Successfully parsed ${results.data.length} rows.`);
            state.allHeaders = results.meta.fields;
            processParsedData(results.data);
        },
        error: (err) => {
            log(`Critical parsing error: ${err.message}`, 'error');
            dom.uploadCard.style.opacity = '1';
        }
    });
}

/**
 * Step 2: Process parsed data into our state.rows format
 * This is where we add our internal properties (id, status, etc.)
 */
function processParsedData(parsedData) {
    state.rows = parsedData.map((data, index) => ({
        id: index,
        data: data,
        selected: false,
        status: 'pending', // 'pending', 'valid', 'invalid', 'duplicate', 'editing'
        error: null,
        originalIndex: index + (state.hasHeader ? 2 : 1) // For 1-based index + header
    }));
    
    // Now that data is processed, validate it
    validateRows();
}

/**
 * Step 3: Validate all rows (Required fields, email, duplicates)
 */
// REPLACE your old 'validateRows' function with this one
function validateRows() {
    log('Validating rows...');
    const linkedInUrls = new Map();
    const duplicates = new Set();
    
    // Reset counts for filters
    const filterCounts = { all: 0, valid: 0, invalid: 0, duplicate: 0 };

    // First pass: find duplicates
    state.rows.forEach(row => {
        const url = row.data['LinkedIn profile'];
        if (url && url.trim() !== '') {
            const normalizedUrl = url.toLowerCase().split('?')[0].trim();
            if (linkedInUrls.has(normalizedUrl)) {
                duplicates.add(normalizedUrl);
                const firstRowId = linkedInUrls.get(normalizedUrl);
                if (state.rows[firstRowId]) { 
                    state.rows[firstRowId].status = 'duplicate';
                    state.rows[firstRowId].error = 'LinkedIn URL is a duplicate in this file.';
                }
            } else {
                linkedInUrls.set(normalizedUrl, row.id);
            }
        }
    });
    
    // Second pass: validate each row
    state.rows.forEach(row => {
        // Skip if already marked as duplicate by the first pass
        if (row.status !== 'duplicate') {
            const url = row.data['LinkedIn profile'];
            if (url && url.trim() !== '' && duplicates.has(url.toLowerCase().split('?')[0].trim())) {
                row.status = 'duplicate';
                row.error = 'LinkedIn URL is a duplicate in this file.';
            }
            
            // --- VALIDATION RELAXED ---
            // Only check for POC Name. Email/Phone are no longer grounds for 'invalid'.
            else if (!row.data['POC Name'] || row.data['POC Name'].trim() === '') {
                row.status = 'invalid';
                row.error = 'POC Name is required.';
            }
            // --- END MODIFICATION ---
            else {
                // All checks passed
                row.status = 'valid';
                row.selected = true; // Auto-select valid rows
            }
        }
        
        // Update filter counts
        filterCounts[row.status]++;
        filterCounts.all++;
    });
    
    log(`Validation complete. Found ${filterCounts.valid} valid rows.`);
    
    // Update filter dropdown count text
    dom.filterDropdown.querySelector('option[value="all"]').textContent = `All (${filterCounts.all})`;
    dom.filterDropdown.querySelector('option[value="valid"]').textContent = `Valid (${filterCounts.valid})`;
    dom.filterDropdown.querySelector('option[value="invalid"]').textContent = `Invalid (${filterCounts.invalid})`;
    dom.filterDropdown.querySelector('option[value="duplicate"]').textContent = `Duplicates (${filterCounts.duplicate})`;
    
    // Render table
    renderTableHeaders();
    rerenderTable(); // This will render the first page respecting the (default 'all') filter
}
/**
 * Clears and re-renders the table based on current filters.
 */
function rerenderTable() {
    state.shownRows = 0; // Reset this legacy property
    dom.previewBody.innerHTML = '';
    
    renderPreviewRows(); // This will render the correct page
    renderPaginationControls(); // This will update the new controls
    updateCounts(); // Update checkboxes and counts
}
function renderPaginationControls() {
    const filteredRows = getFilteredRows();
    const totalRows = filteredRows.length;
    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
    
    // Ensure currentPage is valid
    if (state.currentPage > totalPages && totalPages > 0) {
        state.currentPage = totalPages;
    }
    if (state.currentPage < 1) {
        state.currentPage = 1;
    }

    const start = Math.min((state.currentPage - 1) * ROWS_PER_PAGE + 1, totalRows);
    const end = Math.min(state.currentPage * ROWS_PER_PAGE, totalRows);

    // Update text
    dom.paginationStart.textContent = start;
    dom.paginationEnd.textContent = end;
    dom.paginationTotal.textContent = totalRows;
    dom.paginationCurrent.textContent = state.currentPage;
    dom.paginationTotalPages.textContent = totalPages > 0 ? totalPages : 1;

    // Update button states
    const canGoPrev = state.currentPage > 1;
    const canGoNext = state.currentPage < totalPages;

    [dom.prevPageBtn, dom.prevPageBtnMobile].forEach(btn => btn.disabled = !canGoPrev);
    [dom.nextPageBtn, dom.nextPageBtnMobile].forEach(btn => btn.disabled = !canGoNext);
    
    // Show/hide the controls
    dom.paginationControls.style.display = totalRows > 0 ? 'flex' : 'none';
}
/**
 * Step 4: Render the table headers based on parsed data
 */
function renderTableHeaders() {
    // Only show headers we care about in the preview
    const previewHeaders = ['POC Name', 'Email ID', 'Company Name', 'LinkedIn profile'];
    
    let headerHtml = `
        <th scope="col" class="relative px-6 py-3">
            <input type="checkbox" id="select-all-checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus-ring dark:bg-gray-600 dark:border-gray-500">
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
    `;
    
    for (const header of previewHeaders) {
        if (state.allHeaders.includes(header)) {
            headerHtml += `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${header}</th>`;
        }
    }
    
    headerHtml += `<th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>`;
    dom.previewHeader.innerHTML = headerHtml;
    
    // Re-add listener for the new "select all" checkbox
    dom.previewHeader.querySelector('#select-all-checkbox').addEventListener('change', handleSelectAll);
}

/**
 * Step 5: Render rows into the preview table
 */
// REPLACE your old 'renderPreviewRows' function with this one
function renderPreviewRows() {
    const filteredRows = getFilteredRows();
    
    // --- PAGINATION LOGIC ---
    const startIndex = (state.currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = state.currentPage * ROWS_PER_PAGE;
    const rowsForPage = filteredRows.slice(startIndex, endIndex);
    // --- END PAGINATION LOGIC ---

    if (rowsForPage.length === 0) {
        dom.previewBody.innerHTML = `
            <tr>
                <td colspan="${state.allHeaders.length + 3}" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No data matching filter "${state.currentFilter}".
                </td>
            </tr>
        `;
    } else {
        let rowsHtml = rowsForPage.map(row => renderRow(row)).join('');
        dom.previewBody.innerHTML = rowsHtml;
    }
    
    // No longer need showMoreContainer logic
    dom.previewCount.textContent = filteredRows.length;
}

/**
 * Helper to render a single row (handles view and edit states)
 */
function renderRow(row) {
    const statusMap = {
        'valid': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        'invalid': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        'duplicate': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        'editing': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        'uploading': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 animate-pulse',
        'success': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        'skipped': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        'pending': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    const statusText = row.status === 'invalid' ? row.error : row.status;
    
    const previewHeaders = ['POC Name', 'Email ID', 'Company Name', 'LinkedIn profile'];
    const isEditing = row.status === 'editing';

    let dataCellsHtml = '';
    for (const header of previewHeaders) {
        if (state.allHeaders.includes(header)) {
            const value = row.data[header] || '';
            if (isEditing) {
                dataCellsHtml += `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <input type="text" data-field="${header}" value="${value}" 
                                class="block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus-ring">
                    </td>
                `;
            } else {
                dataCellsHtml += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${value}</td>`;
            }
        }
    }

    return `
        <tr data-row-id="${row.id}" class="${row.status === 'invalid' ? 'bg-red-50 dark:bg-red-900/20' : ''}">
            <td class="px-6 py-4">
                <input type="checkbox" class="row-checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus-ring dark:bg-gray-600 dark:border-gray-500" 
                        ${row.selected ? 'checked' : ''} ${row.status === 'invalid' ? 'disabled' : ''}>
            </td>
            <td class="px-6 py-4 whitespace-nowrap" title="${row.error || row.status}">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[row.status] || statusMap['pending']} truncate">
                    ${statusText}
                </span>
            </td>
            ${dataCellsHtml}
            <td class="px-6 py-4 text-right text-sm space-x-2 whitespace-nowrap">
                ${isEditing ? `
                    <button data-action="save" title="Save" class="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 focus-ring rounded">${ICONS.save}</button>
                    <button data-action="cancel" title="Cancel" class="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 focus-ring rounded">${ICONS.cancel}</button>
                ` : `
                    <button data-action="edit" title="Edit" class="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 focus-ring rounded">${ICONS.edit}</button>
                `}
            </td>
        </tr>
    `;
}

/**
 * Re-renders a single row in the table
 */
function updateRowInDOM(rowId) {
    const row = state.rows.find(r => r.id === rowId);
    if (!row) return;
    
    const tr = dom.previewBody.querySelector(`tr[data-row-id="${rowId}"]`);
    if (tr) {
        tr.outerHTML = renderRow(row);
    }
}

/**
 * Update all counts and button states
 */
function updateCounts() {
    const selectedCount = state.rows.filter(r => r.selected).length;
    dom.uploadCount.textContent = selectedCount;
    dom.uploadBtn.disabled = (selectedCount === 0 || state.isUploading);
    
    // Update main checkbox state
    const allVisibleRows = state.rows.slice(0, state.shownRows);
    const allVisibleSelected = allVisibleRows.every(r => r.selected || r.status === 'invalid');
    const someVisibleSelected = allVisibleRows.some(r => r.selected);
    const mainCheckbox = dom.previewHeader.querySelector('#select-all-checkbox');
    if (mainCheckbox) {
        mainCheckbox.checked = allVisibleSelected;
        mainCheckbox.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
}

/**
 * Step 6: Start the upload process
 */
async function startUpload() {
    const rowsToUpload = state.rows.filter(r => r.selected && (r.status === 'valid' || r.status === 'duplicate'));
    if (rowsToUpload.length === 0) {
        log('No valid rows selected for upload.', 'warn');
        return;
    }
    
    log(`Starting upload for ${rowsToUpload.length} rows...`);
    
    // Reset stats
    state.isUploading = true;
    state.uploadStats = { total: rowsToUpload.length, success: 0, skipped: 0, failed: 0 };
    
    // Update UI
    dom.progressCard.style.display = 'block';
    dom.uploadBtn.disabled = true;
    dom.uploadBtn.innerHTML = 'Uploading...';
    updateProgress();

    for (const row of rowsToUpload) {
        row.status = 'uploading';
        updateRowInDOM(row.id);
        
        try {
            // We use .insert() on a single row
            const { error } = await supabaseClient
                .from('mypocs')
                .insert(row.data); // 'row.data' is the clean, trimmed object

            if (error) throw error;
            
            row.status = 'success';
            state.uploadStats.success++;
            log(`Success: Row ${row.originalIndex} (${row.data['POC Name']})`, 'success');

        } catch (err) {
            if (err.message && err.message.includes('mypocs_linkedin_profile_unique')) {
                row.status = 'skipped';
                state.uploadStats.skipped++;
                row.error = 'Duplicate in database.';
                log(`Skipped: Row ${row.originalIndex} (LinkedIn URL is a duplicate in DB).`, 'warn');
            } else {
                row.status = 'failed';
                state.uploadStats.failed++;
                row.error = err.message;
                log(`Failed: Row ${row.originalIndex}. Error: ${err.message}`, 'error');
            }
        }
        
        row.selected = false; // Deselect after processing
        updateRowInDOM(row.id);
        updateProgress();
    }
    
    // Upload complete
    log('--- Upload Complete ---', 'success');
    log(`Success: ${state.uploadStats.success}, Skipped: ${state.uploadStats.skipped}, Failed: ${state.uploadStats.failed}`);
    state.isUploading = false;
    dom.uploadBtn.innerHTML = `Upload <span id="upload-count">0</span> Selected Rows`;
    dom.uploadCount = document.getElementById('upload-count'); // Re-find element
    updateCounts();
    
    if (state.uploadStats.failed > 0 || state.uploadStats.skipped > 0) {
        dom.downloadErrorsBtn.disabled = false;
    }
}

/**
 * Helper to update the progress bar and stats
 */
function updateProgress() {
    const { total, success, skipped, failed } = state.uploadStats;
    const processed = success + skipped + failed;
    const percent = total > 0 ? (processed / total) * 100 : 0;
    
    dom.progressBar.style.width = `${percent}%`;
    dom.progressText.textContent = `${processed} / ${total}`;
    dom.statSuccess.textContent = success;
    dom.statSkipped.textContent = skipped;
    dom.statFailed.textContent = failed;
}


// --- EVENT HANDLERS ---

// Drag and Drop
dom.dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.dropArea.classList.add('drag-over');
});
dom.dropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.dropArea.classList.remove('drag-over');
});
dom.dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dom.dropArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
        dom.fileInput.files = e.dataTransfer.files; // Assign to hidden input
        handleDataInput(file);
    } else {
        log('Invalid file type. Please drop a .csv file.', 'error');
    }
});
[dom.prevPageBtn, dom.prevPageBtnMobile].forEach(btn => {
    btn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            rerenderTable();
        }
    });
});
[dom.nextPageBtn, dom.nextPageBtnMobile].forEach(btn => {
    btn.addEventListener('click', () => {
        const totalRows = getFilteredRows().length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            rerenderTable();
        }
    });
});
dom.filterDropdown.addEventListener('change', (e) => {
    // Update state from the dropdown's selected value
    state.currentFilter = e.target.value;
    state.currentPage = 1; // <-- RESET TO PAGE 1
    
    // Re-render the table
    rerenderTable();
});

// File Input & Paste
dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleDataInput(file);
});

dom.pasteArea.addEventListener('input', debounce((e) => {
    const text = e.target.value;
    if (text && text.length > 10) { // Simple check
        handleDataInput(text);
    }
}, 500));

dom.headerToggle.addEventListener('change', () => {
    state.hasHeader = dom.headerToggle.checked;
    log(`Header row is now ${state.hasHeader ? 'ON' : 'OFF'}. Please re-submit data.`);
    // A full re-process is needed if this changes
});

dom.selectAllValidBtn.addEventListener('click', () => {
    state.rows.forEach(row => {
        if (row.status === 'valid') row.selected = true;
    });
    // Re-render all visible rows
    dom.previewBody.querySelectorAll('tr').forEach(tr => {
        const row = state.rows.find(r => r.id == tr.dataset.rowId);
        if (row && row.status === 'valid') {
            tr.querySelector('.row-checkbox').checked = true;
        }
    });
    updateCounts();
});

dom.deselectAllBtn.addEventListener('click', () => {
    state.rows.forEach(row => row.selected = false);
    dom.previewBody.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
    updateCounts();
});

// Table Event Delegation
dom.previewBody.addEventListener('click', (e) => {
    const rowCheckbox = e.target.closest('.row-checkbox');
    const actionButton = e.target.closest('button');
    const tr = e.target.closest('tr');
    if (!tr) return;
    
    const rowId = parseInt(tr.dataset.rowId);
    const row = state.rows.find(r => r.id === rowId);
    
    if (rowCheckbox) {
        // Handle row selection
        row.selected = rowCheckbox.checked;
        updateCounts();
    } else if (actionButton) {
        // Handle row actions
        const action = actionButton.dataset.action;
        
        if (action === 'edit') {
            row.status = 'editing';
            updateRowInDOM(rowId);
        }
        
        if (action === 'cancel') {
            // Don't re-validate, just revert status
            validateRows(); // This is easier, re-validates all
            // updateRowInDOM(rowId);
        }
        
        if (action === 'save') {
            // 1. Get new data from inputs
            const inputs = tr.querySelectorAll('input[data-field]');
            inputs.forEach(input => {
                row.data[input.dataset.field] = input.value.trim();
            });
            
            // 2. Re-validate this row (and check for new duplicates)
            // Easiest is to re-run full validation
            validateRows(); 
            
            // 3. Re-render this row (state is set by validateRows)
            // updateRowInDOM(rowId); // validateRows will call render
        }
    }
});

function handleSelectAll(e) {
    const isChecked = e.target.checked;
    // Select/deselect all *visible* rows
    const visibleRowIds = Array.from(dom.previewBody.querySelectorAll('tr')).map(tr => parseInt(tr.dataset.rowId));
    
    state.rows.forEach(row => {
        if (visibleRowIds.includes(row.id) && row.status !== 'invalid') {
            row.selected = isChecked;
        }
    });
    
    dom.previewBody.querySelectorAll('.row-checkbox').forEach(cb => {
        if (!cb.disabled) cb.checked = isChecked;
    });
    updateCounts();
}

// Log & Modal Buttons
dom.clearLogsBtn.addEventListener('click', () => {
    dom.logContainer.innerHTML = '<p class="text-gray-400 italic">Logs cleared.</p>';
});

dom.downloadErrorsBtn.addEventListener('click', () => {
    log('Generating error CSV...');
    const errorRows = state.rows
        .filter(r => r.status === 'failed' || r.status === 'skipped')
        .map(r => ({ ...r.data, 'Upload Error': r.error }));
        
    if (errorRows.length === 0) {
        log('No error rows to download.', 'warn');
        return;
    }
    
    const csv = Papa.unparse(errorRows, { header: true });
    downloadCSV(csv, 'upload-errors.csv');
});

dom.downloadSampleBtn.addEventListener('click', () => {
    const sampleHeaders = REQUIRED_COLUMNS.concat(['Company Name', 'Designation', 'Phone Number', 'Remarks']).join(',');
    const sampleRow = `"Example Inc.","Jane Doe","Engineer","1234567890","jane.doe@example.com","linkedin.com/in/janedoe","This is a sample remark, with a comma"`;
    const csv = `${sampleHeaders}\n${sampleRow}`;
    downloadCSV(csv, 'sample-pocs.csv');
});

// Help Modal
dom.helpBtn.addEventListener('click', () => dom.helpModal.showModal());
dom.closeHelpModal.addEventListener('click', () => dom.helpModal.close());

// Confirm Modal
dom.uploadBtn.addEventListener('click', () => {
    const selectedCount = state.rows.filter(r => r.selected).length;
    dom.confirmCount.textContent = selectedCount;
    dom.confirmModal.showModal();
});
dom.cancelUploadBtn.addEventListener('click', () => dom.confirmModal.close());
dom.confirmUploadBtn.addEventListener('click', () => {
    dom.confirmModal.close();
    startUpload();
});

// --- INITIALIZATION ---
function init() {
    // Set initial dark mode
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setDarkMode(true);
    } else {
        setDarkMode(false);
    }
    
    // Hide panels
    dom.previewCard.style.display = 'none';
    dom.progressCard.style.display = 'none';
    dom.logCard.style.display = 'none';
}
// --- MAIN APP STARTUP ---
/**
 * This new main function runs on page load.
 * It fetches the secure keys from our server and then starts the app.
 */
async function main() {
    try {
        // 1. Fetch the secure config from our server's /config endpoint
        const response = await fetch('/config');
        if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.statusText}`);
        }
        const config = await response.json();

        if (config.error || !config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error(config.error || 'Server config is missing Supabase credentials.');
        }
        
        // 2. Initialize the Supabase client using the fetched keys
        //    This line makes 'supabaseClient' available to all other functions (like startUpload)
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
        
        // 3. Run the rest of the app's initialization
        init();

    } catch (error) {
        // If we can't load the config, show a fatal error.
        console.error('Failed to initialize application:', error);
        document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif; background: #fff; height: 100vh;">
            <h2>Fatal Error</h2>
            <p>Could not load application configuration from the server.</p>
            <p>Please check the console and ensure the server is running and the .env file is correct.</p>
            <p><strong>Error:</strong> ${error.message}</p>
        </div>`;
    }
}

// Start the application
main();