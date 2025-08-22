const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data files
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');
const VOLUNTEERS_FILE = path.join(__dirname, 'data', 'volunteers.json');

// Gate codes
const VOLUNTEER_GATE_CODE = '1957';
const ORGANIZER_PASSWORD = '5791';

// Email configuration
const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Initialize data files
async function initializeDataFiles() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });

        // Initialize events.json
        try {
            await fs.access(EVENTS_FILE);
        } catch {
            const defaultEvent = {
                id: 'spring-cleanup-2024',
                name: 'Spring Cleanup & Maintenance',
                date: '2024-04-15',
                time: '9:00 AM - 4:00 PM',
                description: 'Join us for our spring work day! Help maintain our beautiful club facilities with landscaping, cleaning, and general maintenance tasks.',
                tasks: [
                    { id: 'landscaping', name: 'Landscaping & Grounds', needed: 6, time: '9:00 AM - 12:00 PM' },
                    { id: 'painting', name: 'Painting & Touch-ups', needed: 4, time: '9:00 AM - 3:00 PM' },
                    { id: 'cleaning', name: 'Deep Cleaning', needed: 5, time: '10:00 AM - 2:00 PM' },
                    { id: 'maintenance', name: 'General Maintenance', needed: 3, time: '9:00 AM - 4:00 PM' },
                    { id: 'setup', name: 'Event Setup/Breakdown', needed: 4, time: '8:00 AM - 5:00 PM' }
                ],
                organizer: {
                    name: 'Glenn Fitzgerald',
                    email: process.env.ORGANIZER_EMAIL || 'glenn@hvscma.com',
                    phone: '845-222-1400'
                }
            };
            await fs.writeFile(EVENTS_FILE, JSON.stringify([defaultEvent], null, 2));
        }

        // Initialize volunteers.json
        try {
            await fs.access(VOLUNTEERS_FILE);
        } catch {
            await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify([], null, 2));
        }

        console.log('✅ Data files initialized');
    } catch (error) {
        console.error('❌ Error initializing data files:', error);
    }
}

// API Routes

// Get current event
app.get('/api/event', async (req, res) => {
    try {
        const events = JSON.parse(await fs.readFile(EVENTS_FILE, 'utf8'));
        res.json(events[0] || null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load event' });
    }
});

// Get volunteers
app.get('/api/volunteers', async (req, res) => {
    try {
        const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
        res.json(volunteers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load volunteers' });
    }
});

// Add volunteer (with gate code validation)
app.post('/api/volunteers', async (req, res) => {
    try {
        const { name, email, phone, task, notes, gateCode } = req.body;

        // Validate gate code
        if (gateCode !== VOLUNTEER_GATE_CODE) {
            return res.status(401).json({ error: 'Invalid gate code' });
        }

        const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
        const events = JSON.parse(await fs.readFile(EVENTS_FILE, 'utf8'));
        const currentEvent = events[0];

        const volunteer = {
            id: Date.now().toString(),
            name,
            email,
            phone: phone || '',
            task,
            notes: notes || '',
            signupDate: new Date().toISOString(),
            eventId: currentEvent.id
        };

        volunteers.push(volunteer);
        await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(volunteers, null, 2));

        // Send thank you email to volunteer
        if (process.env.EMAIL_USER) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: `Thank you for volunteering - ${currentEvent.name}`,
                    html: `
                        <h2>Thank You for Volunteering!</h2>
                        <p>Dear ${name},</p>
                        <p>Thank you for signing up to help with <strong>${currentEvent.name}</strong>.</p>
                        <p><strong>Event Details:</strong></p>
                        <ul>
                            <li><strong>Date:</strong> ${currentEvent.date}</li>
                            <li><strong>Time:</strong> ${currentEvent.time}</li>
                            <li><strong>Your Role:</strong> ${task}</li>
                        </ul>
                        <p>We'll send you more details closer to the event date.</p>
                        <p>Questions? Contact ${currentEvent.organizer.name} at ${currentEvent.organizer.phone}</p>
                        <p>Thank you for your commitment to our club!</p>
                    `
                });
            } catch (emailError) {
                console.log('Email sending failed:', emailError.message);
            }
        }

        // Send organizer update email
        if (process.env.EMAIL_USER && currentEvent.organizer.email) {
            try {
                const volunteerCount = volunteers.filter(v => v.eventId === currentEvent.id).length;
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: currentEvent.organizer.email,
                    subject: `New Volunteer Signup - ${currentEvent.name}`,
                    html: `
                        <h2>New Volunteer Signup</h2>
                        <p><strong>Event:</strong> ${currentEvent.name}</p>
                        <p><strong>New Volunteer:</strong> ${name} (${email})</p>
                        <p><strong>Role:</strong> ${task}</p>
                        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                        <p><strong>Notes:</strong> ${notes || 'None'}</p>
                        <p><strong>Total Volunteers:</strong> ${volunteerCount}</p>
                        <hr>
                        <p><strong>Current Volunteer Roster:</strong></p>
                        ${volunteers.filter(v => v.eventId === currentEvent.id)
                            .map(v => `<p>• ${v.name} - ${v.task} (${v.email})</p>`).join('')}
                    `
                });
            } catch (emailError) {
                console.log('Organizer email failed:', emailError.message);
            }
        }

        res.json({ success: true, volunteer });
    } catch (error) {
        console.error('Error adding volunteer:', error);
        res.status(500).json({ error: 'Failed to add volunteer' });
    }
});

// Remove volunteer (with gate code validation)
app.delete('/api/volunteers/:id', async (req, res) => {
    try {
        const { gateCode } = req.body;

        if (gateCode !== VOLUNTEER_GATE_CODE) {
            return res.status(401).json({ error: 'Invalid gate code' });
        }

        const volunteers = JSON.parse(await fs.readFile(VOLUNTEERS_FILE, 'utf8'));
        const filteredVolunteers = volunteers.filter(v => v.id !== req.params.id);

        await fs.writeFile(VOLUNTEERS_FILE, JSON.stringify(filteredVolunteers, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove volunteer' });
    }
});

// Organizer routes (password protected)
app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    if (password === ORGANIZER_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Update event (organizer only)
app.put('/api/admin/event', async (req, res) => {
    try {
        const { password, event } = req.body;

        if (password !== ORGANIZER_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        await fs.writeFile(EVENTS_FILE, JSON.stringify([event], null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Start server
initializeDataFiles().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Volunteer Management System running on port ${PORT}`);
        console.log(`📧 Email configured: ${!!process.env.EMAIL_USER}`);
    });
});
