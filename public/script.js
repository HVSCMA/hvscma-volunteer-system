// Global variables
let currentEvent = null;
let volunteers = [];
let pendingVolunteerData = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadEventData();
    loadVolunteers();
});

// Load event data from server
async function loadEventData() {
    try {
        const response = await fetch('/api/event');
        currentEvent = await response.json();

        if (currentEvent) {
            updateEventDisplay();
            populateTaskDropdown();
        }
    } catch (error) {
        console.error('Error loading event data:', error);
    }
}

// Load volunteers from server
async function loadVolunteers() {
    try {
        const response = await fetch('/api/volunteers');
        volunteers = await response.json();
        displayVolunteers();
    } catch (error) {
        console.error('Error loading volunteers:', error);
    }
}

// Update event display on main page
function updateEventDisplay() {
    if (!currentEvent) return;

    // Update header
    const eventName = document.getElementById('event-name');
    if (eventName) eventName.textContent = currentEvent.name;

    // Update event details
    const eventTitle = document.getElementById('event-title');
    const eventDate = document.getElementById('event-date');
    const eventTime = document.getElementById('event-time');
    const eventDescription = document.getElementById('event-description');

    if (eventTitle) eventTitle.textContent = currentEvent.name;
    if (eventDate) eventDate.textContent = new Date(currentEvent.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    if (eventTime) eventTime.textContent = currentEvent.time;
    if (eventDescription) eventDescription.textContent = currentEvent.description;
}

// Populate task dropdown for signup form
function populateTaskDropdown() {
    const taskSelect = document.getElementById('volunteer-task');
    if (!taskSelect || !currentEvent) return;

    // Clear existing options (keep first placeholder option)
    taskSelect.innerHTML = '<option value="">Select a task...</option>';

    currentEvent.tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.name;
        option.textContent = `${task.name} (${task.time})`;
        taskSelect.appendChild(option);
    });
}

// Display volunteers and tasks
function displayVolunteers() {
    const tasksContainer = document.getElementById('tasks-container');
    if (!tasksContainer || !currentEvent) return;

    tasksContainer.innerHTML = '';

    currentEvent.tasks.forEach(task => {
        const taskVolunteers = volunteers.filter(v => v.task === task.name);
        const taskCard = createTaskCard(task, taskVolunteers);
        tasksContainer.appendChild(taskCard);
    });
}

// Create task card HTML
function createTaskCard(task, taskVolunteers) {
    const card = document.createElement('div');
    card.className = 'task-card';

    const progressClass = taskVolunteers.length >= task.needed ? 'complete' : 
                         taskVolunteers.length > 0 ? 'partial' : 'empty';

    card.innerHTML = `
        <div class="task-header">
            <div class="task-name">${task.name}</div>
            <div class="task-count ${progressClass}">${taskVolunteers.length}/${task.needed}</div>
        </div>
        <div class="task-time">📅 ${task.time}</div>
        <div class="volunteers-list">
            ${taskVolunteers.length > 0 ? 
                taskVolunteers.map(volunteer => 
                    `<div class="volunteer-item">
                        <div>
                            <div class="volunteer-name">${volunteer.name}</div>
                            <div class="volunteer-contact">${volunteer.email}</div>
                        </div>
                        <button class="remove-volunteer" onclick="showDeleteModal('${volunteer.id}', '${volunteer.name}', '${volunteer.task}')" title="Remove volunteer">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`
                ).join('') :
                '<div style="color: #666; font-style: italic; padding: 1rem;">No volunteers yet - be the first!</div>'
            }
        </div>
    `;

    return card;
}

// Handle signup form submission
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignupSubmit();
        });
    }
});

function handleSignupSubmit() {
    const formData = new FormData(document.getElementById('signup-form'));

    pendingVolunteerData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        task: formData.get('task'),
        notes: formData.get('notes') || ''
    };

    // Validate required fields
    if (!pendingVolunteerData.name || !pendingVolunteerData.email || !pendingVolunteerData.task) {
        showModal('error-modal');
        document.getElementById('error-message').textContent = 'Please fill in all required fields.';
        return;
    }

    // Show gate code modal
    showModal('gate-code-modal');
    document.getElementById('gate-code-input').focus();
}

// Submit volunteer signup with gate code
async function submitVolunteerSignup() {
    const gateCode = document.getElementById('gate-code-input').value;

    if (!pendingVolunteerData) return;

    try {
        const response = await fetch('/api/volunteers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...pendingVolunteerData,
                gateCode: gateCode
            })
        });

        const result = await response.json();

        if (result.success) {
            // Success - close gate code modal and show success
            closeModal('gate-code-modal');
            showModal('success-modal');

            // Reset form and reload data
            document.getElementById('signup-form').reset();
            pendingVolunteerData = null;
            await loadVolunteers();
        } else {
            // Show error in gate code modal
            document.getElementById('gate-code-error').style.display = 'block';
            document.getElementById('gate-code-input').value = '';
            document.getElementById('gate-code-input').focus();
        }
    } catch (error) {
        console.error('Signup failed:', error);
        document.getElementById('gate-code-error').style.display = 'block';
        document.getElementById('gate-code-input').value = '';
    }
}

// Show delete confirmation modal
function showDeleteModal(volunteerId, volunteerName, volunteerRole) {
    document.getElementById('delete-volunteer-name').textContent = volunteerName;
    document.getElementById('delete-volunteer-role').textContent = volunteerRole;
    document.getElementById('delete-gate-code').value = '';

    // Store volunteer ID for deletion
    window.pendingDeleteId = volunteerId;

    showModal('delete-modal');
    document.getElementById('delete-gate-code').focus();
}

// Confirm volunteer deletion
async function confirmDeleteVolunteer() {
    const gateCode = document.getElementById('delete-gate-code').value;

    if (!window.pendingDeleteId) return;

    try {
        const response = await fetch(`/api/volunteers/${window.pendingDeleteId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gateCode: gateCode })
        });

        const result = await response.json();

        if (result.success) {
            closeModal('delete-modal');
            await loadVolunteers(); // Reload volunteer data
            window.pendingDeleteId = null;
        } else {
            // Show error - invalid gate code
            alert('Invalid gate code. Please try again.');
            document.getElementById('delete-gate-code').value = '';
            document.getElementById('delete-gate-code').focus();
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Error removing volunteer. Please try again.');
    }
}

// Modal management functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';

        // Hide any error messages when opening modal
        const errorElement = modal.querySelector('.gate-code-error, .password-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';

        // Clear any input values
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => input.value = '');

        // Hide error messages
        const errorElements = modal.querySelectorAll('.gate-code-error, .password-error');
        errorElements.forEach(error => error.style.display = 'none');
    }
}

function closeGateCodeModal() {
    closeModal('gate-code-modal');
    pendingVolunteerData = null;
}

// Print functionality
function printVolunteerList() {
    window.print();
}

// Handle Enter key for gate code input
document.addEventListener('DOMContentLoaded', function() {
    const gateCodeInput = document.getElementById('gate-code-input');
    if (gateCodeInput) {
        gateCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitVolunteerSignup();
            }
        });
    }

    const deleteGateCode = document.getElementById('delete-gate-code');
    if (deleteGateCode) {
        deleteGateCode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmDeleteVolunteer();
            }
        });
    }
});

// Close modals when clicking outside
window.addEventListener('click', function(e) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Auto-refresh data every 30 seconds
setInterval(async function() {
    try {
        await loadVolunteers();
    } catch (error) {
        console.log('Auto-refresh failed:', error);
    }
}, 30000);

// Service worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}