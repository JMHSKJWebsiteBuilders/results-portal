// ==================== CONFIGURATION ====================
// Cloudflare Worker URL - Yahan apna worker URL daalein
const API_BASE = 'https://results-api.YOUR-SUBDOMAIN.workers.dev';

// ==================== GLOBAL VARIABLES ====================
let currentAdmin = null;
let isAdminMode = false;

// ==================== UTILITY FUNCTIONS ====================
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function closeModal(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.remove();
    }
}

// ==================== API CALLS ====================
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    // Add auth token if admin is logged in
    if (currentAdmin && currentAdmin.token) {
        options.headers['Authorization'] = `Bearer ${currentAdmin.token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'API Error');
    }
    
    return response.json();
}

// ==================== LOAD DATA ====================
async function loadCourses() {
    try {
        const data = await apiCall('/api/courses');
        const courseSelect = document.getElementById('courseSelect');
        
        if (!courseSelect) return;
        
        courseSelect.innerHTML = '<option value="">Choose Course...</option>';
        
        Object.entries(data.courses || {}).forEach(([courseId, course]) => {
            const option = document.createElement('option');
            option.value = courseId;
            option.textContent = course.courseName;
            option.dataset.parts = JSON.stringify(course.parts || {});
            courseSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

async function loadBoards() {
    try {
        const data = await apiCall('/api/boards');
        const boardSelect = document.getElementById('boardSelect');
        
        if (!boardSelect) return;
        
        boardSelect.innerHTML = '<option value="">Choose Board...</option>';
        
        Object.entries(data.boards || {}).forEach(([boardId, board]) => {
            const option = document.createElement('option');
            option.value = boardId;
            option.textContent = board.name;
            option.dataset.logoUrl = board.logoUrl || '';
            boardSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading boards:', error);
    }
}

// ==================== COURSE SELECTION ====================
document.addEventListener('DOMContentLoaded', function() {
    const courseSelect = document.getElementById('courseSelect');
    
    if (courseSelect) {
        courseSelect.addEventListener('change', function() {
            const partSelect = document.getElementById('partSelect');
            
            if (!this.value) {
                partSelect.disabled = true;
                partSelect.innerHTML = '<option value="">Select Course First...</option>';
                return;
            }
            
            const selectedOption = this.options[this.selectedIndex];
            const parts = JSON.parse(selectedOption.dataset.parts || '{}');
            
            partSelect.disabled = false;
            partSelect.innerHTML = '<option value="">Choose Part/Year/Semester...</option>';
            
            Object.entries(parts).forEach(([partId, part]) => {
                const option = document.createElement('option');
                option.value = partId;
                option.textContent = part.name;
                option.dataset.subjects = JSON.stringify(part.subjects || []);
                partSelect.appendChild(option);
            });
        });
    }
});

// ==================== RESULT CHECKER ====================
document.addEventListener('DOMContentLoaded', function() {
    const resultForm = document.getElementById('resultCheckerForm');
    
    if (resultForm) {
        resultForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const courseId = document.getElementById('courseSelect').value;
            const partId = document.getElementById('partSelect').value;
            const academicYear = document.getElementById('academicYearSelect').value;
            const boardId = document.getElementById('boardSelect').value;
            const rollNumber = document.getElementById('rollNumberInput').value.trim();
            
            if (!courseId || !partId || !academicYear || !boardId || !rollNumber) {
                alert('Please fill all required fields');
                return;
            }
            
            showLoading();
            
            try {
                const data = await apiCall('/api/results/check', 'POST', {
                    courseId,
                    partId,
                    academicYear,
                    boardId,
                    rollNumber
                });
                
                if (data.result) {
                    displayResult(data.result);
                } else {
                    alert('No result found for this roll number');
                }
            } catch (error) {
                console.error('Error:', error);
                alert(error.message || 'Error loading result. Please try again.');
            } finally {
                hideLoading();
            }
        });
    }
});

// ==================== DISPLAY RESULT ====================
function displayResult(result) {
    const resultContent = document.getElementById('resultContent');
    
    // Calculate totals
    const subjects = result.subjects || {};
    let totalMarks = 0;
    let obtainedMarks = 0;
    
    Object.values(subjects).forEach(subject => {
        totalMarks += subject.totalMarks;
        obtainedMarks += subject.obtainedMarks;
    });
    
    const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(2) : 0;
    const grade = calculateGrade(percentage);
    const status = percentage >= 50 ? 'PASS' : 'FAIL';
    
    // Build table rows
    let tableRows = '';
    Object.entries(subjects).forEach(([subjectName, marks]) => {
        const subPercentage = marks.totalMarks > 0 ? ((marks.obtainedMarks / marks.totalMarks) * 100).toFixed(2) : 0;
        const subGrade = calculateGrade(subPercentage);
        
        tableRows += `
            <tr>
                <td><strong>${subjectName}</strong></td>
                <td style="text-align: center;">${marks.totalMarks}</td>
                <td style="text-align: center;">${marks.obtainedMarks}</td>
                <td style="text-align: center;">${subPercentage}%</td>
                <td style="text-align: center;">${subGrade}</td>
            </tr>
        `;
    });
    
    resultContent.innerHTML = `
        <!-- Student Information -->
        <div class="student-info-grid">
            <div class="info-item">
                <span class="info-label">Student Name</span>
                <span class="info-value">${result.studentName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Father's Name</span>
                <span class="info-value">${result.fatherName || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Roll Number</span>
                <span class="info-value">${result.rollNumber}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Course</span>
                <span class="info-value">${result.courseName}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Part/Year</span>
                <span class="info-value">${result.partName}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Academic Year</span>
                <span class="info-value">${result.academicYear}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Board</span>
                <span class="info-value">${result.boardName}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Verification No.</span>
                <span class="info-value">${result.verificationNumber || 'N/A'}</span>
            </div>
        </div>

        <!-- Marks Details -->
        <h3 class="section-title">Subject-wise Marks</h3>
        <div class="marks-table-container">
            <table class="marks-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th style="text-align: center;">Total Marks</th>
                        <th style="text-align: center;">Obtained Marks</th>
                        <th style="text-align: center;">Percentage</th>
                        <th style="text-align: center;">Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>

        <!-- Summary -->
        <h3 class="section-title">Result Summary</h3>
        <div class="summary-grid">
            <div class="summary-box">
                <div class="summary-label">Total Marks</div>
                <div class="summary-value">${totalMarks}</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Obtained Marks</div>
                <div class="summary-value">${obtainedMarks}</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Percentage</div>
                <div class="summary-value">${percentage}%</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Grade</div>
                <div class="summary-value">${grade}</div>
            </div>
            <div class="summary-box" style="grid-column: span 2;">
                <div class="summary-label">Status</div>
                <div class="summary-value">
                    <span class="grade-badge ${status === 'FAIL' ? 'fail' : ''}">${status}</span>
                </div>
            </div>
        </div>

        ${result.remarks ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px;">
                <strong style="color: var(--primary);">Remarks:</strong><br>
                ${result.remarks}
            </div>
        ` : ''}

        <!-- Signatures -->
        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-line">
                    ${result.principalSignature ? `<img src="${result.principalSignature}" class="signature-img" alt="Principal Signature">` : ''}
                </div>
                <div class="signature-label">Principal's Signature</div>
            </div>
            <div class="signature-box">
                <div class="signature-line">
                    ${result.examControllerSignature ? `<img src="${result.examControllerSignature}" class="signature-img" alt="Controller Signature">` : ''}
                </div>
                <div class="signature-label">Controller of Examinations</div>
            </div>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: var(--text-medium);">
            <p>Date of Issue: ${result.issueDate || new Date().toLocaleDateString()}</p>
            <p style="margin-top: 5px;">This is a computer-generated result card and does not require a seal.</p>
        </div>
    `;
    
    // Show result card
    document.getElementById('resultChecker').style.display = 'none';
    document.getElementById('resultCardContainer').classList.add('active');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== UTILITY FUNCTIONS ====================
function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+ (Excellent)';
    if (percentage >= 80) return 'A (Very Good)';
    if (percentage >= 70) return 'B (Good)';
    if (percentage >= 60) return 'C (Satisfactory)';
    if (percentage >= 50) return 'D (Pass)';
    return 'F (Fail)';
}

function calculateResultPercentage(subjects) {
    let total = 0;
    let obtained = 0;
    
    Object.values(subjects || {}).forEach(subject => {
        total += subject.totalMarks;
        obtained += subject.obtainedMarks;
    });
    
    return total > 0 ? ((obtained / total) * 100) : 0;
}

function backToChecker() {
    document.getElementById('resultChecker').style.display = 'block';
    document.getElementById('resultCardContainer').classList.remove('active');
    document.getElementById('resultCheckerForm').reset();
    document.getElementById('partSelect').disabled = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== ADMIN LOGIN ====================
function showAdminLogin() {
    const modalHTML = `
        <div class="modal-overlay" id="adminLoginModal" onclick="closeModal(event)">
            <div class="admin-modal" style="max-width: 450px;" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-user-shield"></i> Admin Portal Login</h3>
                    <button class="modal-close" onclick="closeAdminLoginModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="adminLoginForm">
                        <div class="form-group">
                            <label class="form-label required">Admin Email</label>
                            <input type="email" class="form-input" id="adminEmail" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Password</label>
                            <input type="password" class="form-input" id="adminPassword" required>
                        </div>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-sign-in-alt"></i>
                            Login as Admin
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
}

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    showLoading();
    
    try {
        const data = await apiCall('/api/admin/login', 'POST', { email, password });
        
        if (data.success) {
            currentAdmin = {
                uid: data.uid,
                email: data.email,
                token: data.token
            };
            isAdminMode = true;
            
            hideLoading();
            closeAdminLoginModal();
            showAdminDashboard();
        } else {
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        hideLoading();
        console.error('Admin login error:', error);
        alert('Login failed: ' + error.message);
    }
}

function closeAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.remove();
}

// ==================== ADMIN DASHBOARD ====================
function showAdminDashboard() {
    const mainContent = document.querySelector('.main-content');
    
    mainContent.innerHTML = `
        <div class="admin-dashboard">
            <div class="admin-header">
                <div class="admin-info">
                    <div class="admin-avatar">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <div>
                        <h2>Admin Dashboard</h2>
                        <p>${currentAdmin.email}</p>
                    </div>
                </div>
                <button class="btn btn-danger" onclick="handleAdminLogout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>

            <div class="admin-nav">
                <button class="admin-nav-btn active" onclick="showAdminSection('results')" id="navResults">
                    <i class="fas fa-award"></i>
                    Results Manager
                </button>
                <button class="admin-nav-btn" onclick="showAdminSection('courses')" id="navCourses">
                    <i class="fas fa-book"></i>
                    Courses Manager
                </button>
                <button class="admin-nav-btn" onclick="showAdminSection('boards')" id="navBoards">
                    <i class="fas fa-university"></i>
                    Boards Manager
                </button>
            </div>

            <div id="adminContent" class="admin-content">
                <div style="text-align: center; padding: 50px;">
                    <div class="spinner"></div>
                    <p style="margin-top: 20px;">Loading...</p>
                </div>
            </div>
        </div>
    `;
    
    showAdminSection('results');
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const navBtn = document.getElementById(`nav${section.charAt(0).toUpperCase() + section.slice(1)}`);
    if (navBtn) navBtn.classList.add('active');
    
    const contentArea = document.getElementById('adminContent');
    
    switch(section) {
        case 'results':
            loadResultsManager(contentArea);
            break;
        case 'courses':
            loadCoursesManager(contentArea);
            break;
        case 'boards':
            loadBoardsManager(contentArea);
            break;
    }
}

// ==================== RESULTS MANAGER ====================
async function loadResultsManager(container) {
    showLoading();
    
    try {
        const data = await apiCall('/api/admin/results');
        hideLoading();
        
        const resultsArray = Object.entries(data.results || {});
        
        container.innerHTML = `
            <h2 class="admin-section-title">
                <i class="fas fa-award"></i>
                Results Manager
            </h2>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-plus-circle"></i>
                    Publish New Result
                </div>
                <button class="btn btn-primary" onclick="openPublishResultModal()">
                    <i class="fas fa-plus"></i>
                    Publish New Result
                </button>
            </div>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-list"></i>
                    Published Results (${resultsArray.length})
                </div>

                ${resultsArray.length === 0 ? `
                    <p style="text-align: center; color: var(--text-medium); padding: 40px;">
                        No results published yet.
                    </p>
                ` : `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Roll Number</th>
                                    <th>Student Name</th>
                                    <th>Course</th>
                                    <th>Year</th>
                                    <th>Percentage</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${resultsArray.map(([resultId, result]) => {
                                    const percentage = calculateResultPercentage(result.subjects);
                                    const status = percentage >= 50 ? 'Pass' : 'Fail';
                                    
                                    return `
                                        <tr>
                                            <td><strong>${result.rollNumber}</strong></td>
                                            <td>${result.studentName || 'N/A'}</td>
                                            <td>${result.courseName}</td>
                                            <td>${result.academicYear}</td>
                                            <td><strong>${percentage.toFixed(2)}%</strong></td>
                                            <td>
                                                <span class="badge badge-${status === 'Pass' ? 'success' : 'danger'}">
                                                    ${status}
                                                </span>
                                            </td>
                                            <td>
                                                <button class="btn btn-sm btn-danger" onclick="deleteResult('${resultId}')">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
        
    } catch (error) {
        hideLoading();
        console.error('Error loading results:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Error loading results. Please try again.</span>
            </div>
        `;
    }
}

// ==================== COURSES MANAGER ====================
async function loadCoursesManager(container) {
    showLoading();
    
    try {
        const data = await apiCall('/api/courses');
        hideLoading();
        
        const coursesArray = Object.entries(data.courses || {});
        
        container.innerHTML = `
            <h2 class="admin-section-title">
                <i class="fas fa-book"></i>
                Courses Manager
            </h2>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-plus-circle"></i>
                    Create New Course
                </div>
                <button class="btn btn-primary" onclick="openCreateCourseModal()">
                    <i class="fas fa-plus"></i>
                    Create New Course
                </button>
            </div>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-list"></i>
                    All Courses (${coursesArray.length})
                </div>

                ${coursesArray.length === 0 ? `
                    <p style="text-align: center; color: var(--text-medium); padding: 40px;">
                        No courses created yet.
                    </p>
                ` : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; margin-top: 20px;">
                        ${coursesArray.map(([courseId, course]) => `
                            <div style="background: white; border-radius: var(--radius-lg); padding: 20px; border-left: 4px solid var(--primary); box-shadow: var(--shadow-2);">
                                <h4 style="color: var(--primary); margin-bottom: 15px;">${course.courseName}</h4>
                                <div style="margin-bottom: 10px;">
                                    <strong>Parts:</strong> ${course.parts ? Object.keys(course.parts).length : 0}
                                </div>
                                <button class="btn btn-sm btn-danger" onclick="deleteCourse('${courseId}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
        
    } catch (error) {
        hideLoading();
        console.error('Error loading courses:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Error loading courses.</span>
            </div>
        `;
    }
}

// ==================== BOARDS MANAGER ====================
async function loadBoardsManager(container) {
    showLoading();
    
    try {
        const data = await apiCall('/api/boards');
        hideLoading();
        
        const boardsArray = Object.entries(data.boards || {});
        
        container.innerHTML = `
            <h2 class="admin-section-title">
                <i class="fas fa-university"></i>
                Boards Manager
            </h2>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-plus-circle"></i>
                    Add New Board
                </div>
                
                <form id="addBoardForm" style="display: grid; gap: 15px;">
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label required">Board Name</label>
                        <input type="text" class="form-input" id="boardName" required>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label">Board Logo URL</label>
                        <input type="url" class="form-input" id="boardLogo">
                    </div>
                    <button type="submit" class="btn btn-success">
                        <i class="fas fa-plus"></i> Add Board
                    </button>
                </form>
            </div>

            <div class="admin-card">
                <div class="admin-card-title">
                    <i class="fas fa-list"></i>
                    All Boards (${boardsArray.length})
                </div>

                ${boardsArray.length === 0 ? `
                    <p style="text-align: center; color: var(--text-medium); padding: 40px;">
                        No boards added yet.
                    </p>
                ` : `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Board Name</th>
                                    <th>Logo</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${boardsArray.map(([boardId, board]) => `
                                    <tr>
                                        <td><strong>${board.name}</strong></td>
                                        <td>${board.logoUrl ? `<img src="${board.logoUrl}" style="max-width: 50px;">` : 'No logo'}</td>
                                        <td>
                                            <button class="btn btn-sm btn-danger" onclick="deleteBoard('${boardId}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
        
        document.getElementById('addBoardForm').addEventListener('submit', addBoard);
        
    } catch (error) {
        hideLoading();
        console.error('Error loading boards:', error);
    }
}

// ==================== CRUD OPERATIONS ====================
async function addBoard(e) {
    e.preventDefault();
    
    const boardName = document.getElementById('boardName').value.trim();
    const boardLogo = document.getElementById('boardLogo').value.trim();
    
    showLoading();
    
    try {
        await apiCall('/api/admin/boards', 'POST', {
            name: boardName,
            logoUrl: boardLogo
        });
        
        hideLoading();
        alert('Board added successfully!');
        loadBoardsManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error adding board: ' + error.message);
    }
}

async function deleteBoard(boardId) {
    if (!confirm('Are you sure you want to delete this board?')) return;
    
    showLoading();
    
    try {
        await apiCall(`/api/admin/boards/${boardId}`, 'DELETE');
        hideLoading();
        alert('Board deleted successfully!');
        loadBoardsManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error deleting board: ' + error.message);
    }
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    
    showLoading();
    
    try {
        await apiCall(`/api/admin/courses/${courseId}`, 'DELETE');
        hideLoading();
        alert('Course deleted successfully!');
        loadCoursesManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error deleting course: ' + error.message);
    }
}

async function deleteResult(resultId) {
    if (!confirm('Are you sure you want to delete this result?')) return;
    
    showLoading();
    
    try {
        await apiCall(`/api/admin/results/${resultId}`, 'DELETE');
        hideLoading();
        alert('Result deleted successfully!');
        loadResultsManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error deleting result: ' + error.message);
    }
}

// ==================== CREATE COURSE MODAL ====================
async function openCreateCourseModal() {
    const modalHTML = `
        <div class="modal-overlay" id="createCourseModal" onclick="closeModal(event)">
            <div class="admin-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Create New Course</h3>
                    <button class="modal-close" onclick="closeCreateCourseModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="createCourseForm">
                        <div class="form-group">
                            <label class="form-label required">Course Name</label>
                            <input type="text" class="form-input" id="courseName" required>
                        </div>

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px;">
                            <h4 style="color: var(--primary); margin-bottom: 15px;">Course Structure</h4>
                            <div id="partsContainer">
                                <div class="part-item subject-item">
                                    <div class="form-group">
                                        <label class="form-label required">Part/Year Name</label>
                                        <input type="text" class="form-input part-name" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label required">Subjects (comma separated)</label>
                                        <textarea class="form-input part-subjects" rows="2" required></textarea>
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="addCoursePart()">
                                <i class="fas fa-plus"></i> Add Part
                            </button>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-success" onclick="saveCourse()">
                        <i class="fas fa-save"></i> Create Course
                    </button>
                    <button class="btn btn-secondary" onclick="closeCreateCourseModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function addCoursePart() {
    const container = document.getElementById('partsContainer');
    const partHTML = `
        <div class="part-item subject-item">
            <button type="button" class="remove-subject" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <div class="form-group">
                <label class="form-label required">Part/Year Name</label>
                <input type="text" class="form-input part-name" required>
            </div>
            <div class="form-group">
                <label class="form-label required">Subjects (comma separated)</label>
                <textarea class="form-input part-subjects" rows="2" required></textarea>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', partHTML);
}

async function saveCourse() {
    const courseName = document.getElementById('courseName').value.trim();
    
    if (!courseName) {
        alert('Please enter course name');
        return;
    }
    
    const partItems = document.querySelectorAll('.part-item');
    const parts = {};
    
    partItems.forEach((item, index) => {
        const partName = item.querySelector('.part-name').value.trim();
        const subjectsText = item.querySelector('.part-subjects').value.trim();
        
        if (partName && subjectsText) {
            const subjects = subjectsText.split(',').map(s => s.trim()).filter(s => s);
            parts[`part${index + 1}`] = { name: partName, subjects: subjects };
        }
    });
    
    if (Object.keys(parts).length === 0) {
        alert('Please add at least one part with subjects');
        return;
    }
    
    showLoading();
    
    try {
        await apiCall('/api/admin/courses', 'POST', {
            courseName: courseName,
            parts: parts
        });
        
        hideLoading();
        alert('Course created successfully!');
        closeCreateCourseModal();
        loadCoursesManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error creating course: ' + error.message);
    }
}

function closeCreateCourseModal() {
    const modal = document.getElementById('createCourseModal');
    if (modal) modal.remove();
}

// ==================== PUBLISH RESULT MODAL ====================
async function openPublishResultModal() {
    showLoading();
    
    try {
        const coursesData = await apiCall('/api/courses');
        const boardsData = await apiCall('/api/boards');
        
        const courses = coursesData.courses || {};
        const boards = boardsData.boards || {};
        
        hideLoading();
        
        const modalHTML = `
            <div class="modal-overlay" id="publishResultModal" onclick="closeModal(event)">
                <div class="admin-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3><i class="fas fa-plus-circle"></i> Publish New Result</h3>
                        <button class="modal-close" onclick="closePublishResultModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="publishResultForm">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label required">Student Name</label>
                                    <input type="text" class="form-input" id="resStudentName" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Father's Name</label>
                                    <input type="text" class="form-input" id="resFatherName" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label required">Course</label>
                                    <select class="form-select" id="resCourse" onchange="loadResultCourseParts()" required>
                                        <option value="">Choose Course...</option>
                                        ${Object.entries(courses).map(([id, c]) => `
                                            <option value="${id}" data-parts='${JSON.stringify(c.parts || {})}' data-name="${c.courseName}">${c.courseName}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Part/Year</label>
                                    <select class="form-select" id="resPart" onchange="loadResultPartSubjects()" required disabled>
                                        <option value="">Select Course First...</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label required">Academic Year</label>
                                    <input type="text" class="form-input" id="resYear" placeholder="e.g., 2025" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Board</label>
                                    <select class="form-select" id="resBoard" required>
                                        <option value="">Choose Board...</option>
                                        ${Object.entries(boards).map(([id, b]) => `
                                            <option value="${id}" data-name="${b.name}">${b.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label required">Roll Number</label>
                                    <input type="text" class="form-input" id="resRollNumber" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Verification Number</label>
                                    <input type="text" class="form-input" id="resVerification" required>
                                </div>
                            </div>

                            <div id="resSubjectsContainer" style="display: none;">
                                <h4 style="color: var(--primary); margin: 25px 0 15px;">Subject Marks</h4>
                                <div id="resSubjectsList"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success" onclick="saveResult()">
                            <i class="fas fa-save"></i> Publish Result
                        </button>
                        <button class="btn btn-secondary" onclick="closePublishResultModal()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
    } catch (error) {
        hideLoading();
        alert('Error loading data: ' + error.message);
    }
}

function loadResultCourseParts() {
    const courseSelect = document.getElementById('resCourse');
    const partSelect = document.getElementById('resPart');
    
    if (!courseSelect.value) {
        partSelect.disabled = true;
        partSelect.innerHTML = '<option value="">Select Course First...</option>';
        return;
    }
    
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const parts = JSON.parse(selectedOption.dataset.parts || '{}');
    
    partSelect.disabled = false;
    partSelect.innerHTML = '<option value="">Choose Part...</option>';
    
    Object.entries(parts).forEach(([partId, part]) => {
        const option = document.createElement('option');
        option.value = partId;
        option.textContent = part.name;
        option.dataset.subjects = JSON.stringify(part.subjects || []);
        partSelect.appendChild(option);
    });
}

function loadResultPartSubjects() {
    const partSelect = document.getElementById('resPart');
    const container = document.getElementById('resSubjectsContainer');
    const list = document.getElementById('resSubjectsList');
    
    if (!partSelect.value) {
        container.style.display = 'none';
        return;
    }
    
    const selectedOption = partSelect.options[partSelect.selectedIndex];
    const subjects = JSON.parse(selectedOption.dataset.subjects || '[]');
    
    list.innerHTML = subjects.map(subject => `
        <div class="subject-item">
            <h5 style="color: var(--primary); margin-bottom: 15px;">${subject}</h5>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label required">Total Marks</label>
                    <input type="number" class="form-input subject-total" data-subject="${subject}" min="0" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Obtained Marks</label>
                    <input type="number" class="form-input subject-obtained" data-subject="${subject}" min="0" required>
                </div>
            </div>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

async function saveResult() {
    const studentName = document.getElementById('resStudentName').value.trim();
    const fatherName = document.getElementById('resFatherName').value.trim();
    const courseSelect = document.getElementById('resCourse');
    const partSelect = document.getElementById('resPart');
    const boardSelect = document.getElementById('resBoard');
    const academicYear = document.getElementById('resYear').value.trim();
    const rollNumber = document.getElementById('resRollNumber').value.trim();
    const verificationNumber = document.getElementById('resVerification').value.trim();
    
    if (!studentName || !fatherName || !courseSelect.value || !partSelect.value || 
        !boardSelect.value || !academicYear || !rollNumber || !verificationNumber) {
        alert('Please fill all required fields');
        return;
    }
    
    const subjects = {};
    const totalInputs = document.querySelectorAll('.subject-total');
    
    let valid = true;
    totalInputs.forEach(input => {
        const subject = input.dataset.subject;
        const totalMarks = parseInt(input.value);
        const obtainedInput = document.querySelector(`.subject-obtained[data-subject="${subject}"]`);
        const obtainedMarks = parseInt(obtainedInput.value);
        
        if (isNaN(totalMarks) || isNaN(obtainedMarks)) {
            valid = false;
            return;
        }
        
        if (obtainedMarks > totalMarks) {
            alert(`Obtained marks cannot exceed total marks for ${subject}`);
            valid = false;
            return;
        }
        
        subjects[subject] = { totalMarks, obtainedMarks };
    });
    
    if (!valid || Object.keys(subjects).length === 0) {
        alert('Please fill all subject marks correctly');
        return;
    }
    
    showLoading();
    
    try {
        await apiCall('/api/admin/results', 'POST', {
            studentName,
            fatherName,
            courseId: courseSelect.value,
            courseName: courseSelect.options[courseSelect.selectedIndex].dataset.name,
            partId: partSelect.value,
            partName: partSelect.options[partSelect.selectedIndex].textContent,
            boardId: boardSelect.value,
            boardName: boardSelect.options[boardSelect.selectedIndex].dataset.name,
            academicYear,
            rollNumber,
            verificationNumber,
            subjects,
            issueDate: new Date().toISOString().split('T')[0]
        });
        
        hideLoading();
        alert('Result published successfully!');
        closePublishResultModal();
        loadResultsManager(document.getElementById('adminContent'));
    } catch (error) {
        hideLoading();
        alert('Error publishing result: ' + error.message);
    }
}

function closePublishResultModal() {
    const modal = document.getElementById('publishResultModal');
    if (modal) modal.remove();
}

// ==================== ADMIN LOGOUT ====================
async function handleAdminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        currentAdmin = null;
        isAdminMode = false;
        location.reload();
    }
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', function() {
    loadCourses();
    loadBoards();
    console.log('✅ Results Portal Initialized');
});
