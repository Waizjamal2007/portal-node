const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ========== MULTER SETUP FOR FILE UPLOAD ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ========== MONGODB CONNECTION ==========
mongoose.connect('mongodb://localhost:27017/nexora_portal')
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    initializeDatabase();
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('💡 Make sure MongoDB is running. Start it with: mongod');
  });

// ========== SCHEMAS ==========

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
});

// Student Schema
const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  enrollmentNo: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  faculty: { type: String, default: 'Waiz Jamal Ashraf' },
  currentSemester: { type: String, required: true },
  studentOfMonth: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Assignment Schema
const assignmentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  assignmentName: { type: String, required: true },
  description: String,
  deadline: String,
  marks: { type: Number, default: 20 },
  facultyFile: { type: String, default: 'No Faculty File' },
  status: { type: String, default: 'Pending' },
  submittedFile: String,
  submittedFileName: String,
  submittedDate: Date,
  createdAt: { type: Date, default: Date.now }
});

// Progress Schema
const progressSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  month: { type: String, required: true },
  year: { type: Number, default: 2025 },
  assignmentMarks: { type: Number, default: 0 },
  quizMarks: { type: Number, default: 0 },
  classesAttended: { type: Number, default: 0 },
  classesHeld: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  remarks: { type: String, default: '' }
});

// Study Material Schema
const studyMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  fileName: String,
  filePath: String,
  uploadDate: { type: Date, default: Date.now }
});

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  studentId: String,
  studentName: String,
  timeliness: String,
  courseCoverage: String,
  doubtClearing: String,
  examsTimeliness: String,
  practiceTime: String,
  remarks: String,
  submittedAt: { type: Date, default: Date.now }
});

// Complaint Schema
const complaintSchema = new mongoose.Schema({
  studentId: String,
  studentName: String,
  subject: String,
  description: String,
  status: { type: String, default: 'Pending' },
  adminResponse: String,
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date
});

// Job Schema
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  company: String,
  location: String,
  salary: String,
  applyBefore: String,
  createdAt: { type: Date, default: Date.now }
});

// ========== MODELS ==========
const Admin = mongoose.model('Admin', adminSchema);
const Student = mongoose.model('Student', studentSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Progress = mongoose.model('Progress', progressSchema);
const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const Job = mongoose.model('Job', jobSchema);

// ========== MIDDLEWARE ==========
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, 'nexora_secret_key_2025');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

// ========== TEST ROUTE ==========
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working perfectly!', timestamp: new Date() });
});

// ========== AUTH ROUTES ==========

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Admin login attempt:', username);
  
  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      console.log('❌ Admin not found:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      console.log('❌ Invalid password for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: admin.username, role: 'admin' }, 
      'nexora_secret_key_2025', 
      { expiresIn: '24h' }
    );
    
    console.log('✅ Admin login successful:', username);
    res.json({ 
      token, 
      user: { name: admin.name, id: admin.username, role: 'admin' } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Student Login
app.post('/api/student/login', async (req, res) => {
  const { studentId, password } = req.body;
  console.log('🔐 Student login attempt:', studentId);
  
  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      console.log('❌ Student not found:', studentId);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, student.password);
    if (!isValid) {
      console.log('❌ Invalid password for:', studentId);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: student.studentId, role: 'student' }, 
      'nexora_secret_key_2025', 
      { expiresIn: '24h' }
    );
    
    console.log('✅ Student login successful:', studentId);
    res.json({ 
      token, 
      user: { name: student.name, id: student.studentId, role: 'student' } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Student Password
app.post('/api/student/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  try {
    const student = await Student.findOne({ studentId: req.userId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const isValid = await bcrypt.compare(currentPassword, student.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== STUDENT ROUTES ==========

// Get Student Details
app.get('/api/student/details', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.userId });
    const studentOfMonth = await Student.findOne({ studentOfMonth: true });
    
    res.json({ 
      student, 
      studentOfMonth: studentOfMonth ? { 
        name: studentOfMonth.name, 
        batch: studentOfMonth.studentId 
      } : null 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Student Assignments
app.get('/api/student/assignments', authMiddleware, async (req, res) => {
  try {
    const assignments = await Assignment.find({ studentId: req.userId });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit Assignment with File
app.post('/api/student/submit-assignment', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { assignmentId } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    assignment.status = 'Submitted';
    assignment.submittedFile = file.filename;
    assignment.submittedFileName = file.originalname;
    assignment.submittedDate = new Date();
    await assignment.save();
    
    res.json({ 
      message: 'Assignment submitted successfully', 
      fileName: file.filename,
      originalName: file.originalname
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ message: 'Error submitting assignment: ' + error.message });
  }
});

// Get Student Progress
app.get('/api/student/progress', authMiddleware, async (req, res) => {
  try {
    const progress = await Progress.find({ studentId: req.userId });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Study Materials
app.get('/api/student/study-materials', async (req, res) => {
  try {
    const materials = await StudyMaterial.find().sort({ uploadDate: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit Feedback
app.post('/api/student/feedback', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.userId });
    const feedback = new Feedback({ 
      studentId: req.userId, 
      studentName: student.name, 
      ...req.body 
    });
    await feedback.save();
    res.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit Complaint
app.post('/api/student/complaints', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.userId });
    const complaint = new Complaint({ 
      studentId: req.userId, 
      studentName: student.name, 
      ...req.body 
    });
    await complaint.save();
    res.json({ message: 'Complaint submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Jobs
app.get('/api/student/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== ADMIN ROUTES ==========

// Dashboard Stats
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalAssignments = await Assignment.countDocuments();
    const totalComplaints = await Complaint.countDocuments();
    const pendingComplaints = await Complaint.countDocuments({ status: 'Pending' });
    const totalFeedback = await Feedback.countDocuments();
    
    res.json({ totalStudents, totalAssignments, totalComplaints, pendingComplaints, totalFeedback });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Students
app.get('/api/admin/students', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add New Student
app.post('/api/admin/students', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, enrollmentNo, email, phone, currentSemester } = req.body;
    
    // Validation
    if (!name || !enrollmentNo || !email || !phone || !currentSemester) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if enrollment number exists
    const existingEnrollment = await Student.findOne({ enrollmentNo });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Enrollment number already exists' });
    }
    
    // Check if email exists
    const existingEmail = await Student.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    const studentId = `STUDENT${enrollmentNo}`;
    const hashedPassword = await bcrypt.hash(studentId, 10);
    
    const student = new Student({
      studentId,
      password: hashedPassword,
      name,
      enrollmentNo,
      email,
      phone,
      faculty: 'Waiz Jamal Ashraf',
      currentSemester
    });
    
    await student.save();
    console.log('✅ Student added:', studentId);
    res.json({ message: 'Student added successfully', student });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ message: 'Error adding student: ' + error.message });
  }
});

// Delete Student
app.delete('/api/admin/students/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Delete related data
    await Assignment.deleteMany({ studentId: student.studentId });
    await Progress.deleteMany({ studentId: student.studentId });
    await Student.findByIdAndDelete(req.params.id);
    
    console.log('✅ Student deleted:', student.studentId);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting student' });
  }
});

// Reset Student Password
app.post('/api/admin/students/reset-password/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const newPassword = student.studentId;
    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();
    
    res.json({ message: `Password reset to ${newPassword}` });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Set Student of the Month
app.post('/api/admin/student-of-month/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await Student.updateMany({}, { studentOfMonth: false });
    await Student.findByIdAndUpdate(req.params.id, { studentOfMonth: true });
    
    res.json({ message: 'Student of the month updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating student of month' });
  }
});

// Get All Assignments
app.get('/api/admin/assignments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const assignments = await Assignment.find().sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Assignment
app.post('/api/admin/assignments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { studentId, assignmentName, description, deadline, marks } = req.body;
    
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const assignment = new Assignment({
      studentId,
      studentName: student.name,
      assignmentName,
      description,
      deadline,
      marks: marks || 20,
      status: 'Pending'
    });
    
    await assignment.save();
    res.json({ message: 'Assignment added successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error adding assignment' });
  }
});

// Update Assignment Status
app.put('/api/admin/assignments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, marks } = req.body;
    await Assignment.findByIdAndUpdate(req.params.id, { status, marks });
    res.json({ message: 'Assignment updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating assignment' });
  }
});

// Get All Progress
app.get('/api/admin/progress', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const progress = await Progress.find().sort({ month: -1 });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Progress
app.post('/api/admin/progress', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { studentId, month, year, assignmentMarks, quizMarks, classesAttended, classesHeld, remarks } = req.body;
    
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const percentage = classesHeld > 0 ? ((classesAttended / classesHeld) * 100).toFixed(2) : 0;
    
    const progress = new Progress({
      studentId,
      studentName: student.name,
      month,
      year: year || 2025,
      assignmentMarks: assignmentMarks || 0,
      quizMarks: quizMarks || 0,
      classesAttended: classesAttended || 0,
      classesHeld: classesHeld || 0,
      percentage,
      remarks: remarks || ''
    });
    
    await progress.save();
    res.json({ message: 'Progress added successfully', progress });
  } catch (error) {
    res.status(500).json({ message: 'Error adding progress' });
  }
});

// Get Study Materials (Admin)
app.get('/api/admin/study-materials', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const materials = await StudyMaterial.find().sort({ uploadDate: -1 });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Study Material
app.post('/api/admin/study-materials', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, fileName, filePath } = req.body;
    const material = new StudyMaterial({ title, description, fileName, filePath });
    await material.save();
    res.json({ message: 'Study material added successfully', material });
  } catch (error) {
    res.status(500).json({ message: 'Error adding study material' });
  }
});

// Delete Study Material
app.delete('/api/admin/study-materials/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await StudyMaterial.findByIdAndDelete(req.params.id);
    res.json({ message: 'Study material deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting study material' });
  }
});

// Get All Feedback
app.get('/api/admin/feedback', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ submittedAt: -1 });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Complaints
app.get('/api/admin/complaints', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Complaint
app.put('/api/admin/complaints/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    const updateData = { status, adminResponse };
    if (status === 'Resolved') updateData.resolvedAt = new Date();
    
    await Complaint.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: 'Complaint updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating complaint' });
  }
});

// Get All Jobs
app.get('/api/admin/jobs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Job
app.post('/api/admin/jobs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.json({ message: 'Job added successfully', job });
  } catch (error) {
    res.status(500).json({ message: 'Error adding job' });
  }
});

// Delete Job
app.delete('/api/admin/jobs/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job' });
  }
});

// ========== INITIALIZE DATABASE ==========
const initializeDatabase = async () => {
  try {
    // Create Admin if not exists
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('waiz2007', 10);
      await Admin.create({
        username: 'admin2007',
        password: hashedPassword,
        name: 'Admin Waiz'
      });
      console.log('✅ Admin created: admin2007 / waiz2007');
    } else {
      console.log('✅ Admin already exists');
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ========================================
  🚀 SERVER RUNNING SUCCESSFULLY
  ========================================
  📡 Port: http://localhost:${PORT}
  🔧 Test API: http://localhost:${PORT}/api/test
  🔐 Admin Login: POST http://localhost:${PORT}/api/admin/login
  👨‍🎓 Student Login: POST http://localhost:${PORT}/api/student/login
  ========================================
  `);
});