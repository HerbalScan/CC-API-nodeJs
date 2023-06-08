// handler.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Inisialisasi Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://auth-c30c8-default-rtdb.asia-southeast1.firebasedatabase.app/'
});

// Referensi ke Firebase Realtime Database
const db = admin.database();

// Mendapatkan referensi ke Firestore
const firestore = admin.firestore();
const plantsCollectionRef = firestore.collection('Tanaman');
const savedPlantsCollectionRef = firestore.collection('SavedPlants');


// Register handler
async function registerHandler(req, res) {
  try {
    const { email, password } = req.body;

    // Cek apakah email sudah digunakan
    const snapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
    if (snapshot.exists()) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan data user ke database
    const userRef = db.ref('users').push();
    await userRef.set({
      email,
      password: hashedPassword
    });

    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Login handler
async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;

    // Cari user berdasarkan email
    const snapshot = await db.ref('users').orderByChild('email').equalTo(email).once('value');
    if (!snapshot.exists()) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Ambil data user
    const users = snapshot.val();
    const userId = Object.keys(users)[0];
    const user = users[userId];

    // Periksa password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate token with expiry time
    const token = jwt.sign({ email }, 'YOUR_SECRET_KEY', { expiresIn: '1h' });

    // Set token in cookies
    res.cookie('token', token, { httpOnly: true });

    res.json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Logout handler
function logoutHandler(req, res) {
  // Hapus token di cookies
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
}

// Middleware untuk verifikasi token
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, 'YOUR_SECRET_KEY');
    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Middleware untuk memeriksa waktu kedaluwarsa token
function verifyTokenExpiry(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, 'YOUR_SECRET_KEY');

    // Periksa waktu kedaluwarsa token
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Token expired' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

async function getPlantById(req, res) {
  try {
    const { id } = req.params;

    // Mengambil data tanaman dari Firestore berdasarkan ID dokumen
    const docRef = plantsCollectionRef.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Mengembalikan data tanaman yang berhasil diambil
    return res.status(200).json({ data: doc.data() });
  } catch (error) {
    console.error('Error getting plant by ID:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
// Handler untuk menyimpan tumbuhan
async function savePlant(req, res) {
  try {
    const { id } = req.body;
    const { email } = req.user;

    // Cek apakah tumbuhan sudah disimpan sebelumnya
    const savedPlantSnapshot = await savedPlantsCollectionRef
      .where('userId', '==', email)
      .where('plantId', '==', id)
      .get();

    if (!savedPlantSnapshot.empty) {
      return res.status(400).json({ error: 'Plant already saved' });
    }

    // Simpan tumbuhan ke daftar yang disimpan
    await savedPlantsCollectionRef.add({
      userId: email,
      plantId: id
    });

    res.json({ message: 'Plant saved successfully' });
  } catch (error) {
    console.error('Error saving plant:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

// Handler untuk mendapatkan daftar tumbuhan yang disimpan
async function getSavedPlants(req, res) {
  try {
    const { email } = req.user;

    // Mengambil daftar tumbuhan yang disimpan oleh pengguna
    const savedPlantsSnapshot = await savedPlantsCollectionRef
      .where('userId', '==', email)
      .get();

    // Mengumpulkan ID tumbuhan yang disimpan
    const plantIds = savedPlantsSnapshot.docs.map(doc => doc.data().plantId);

    // Mengambil data tumbuhan berdasarkan ID yang disimpan
    const plantsSnapshot = await plantsCollectionRef
      .where(admin.firestore.FieldPath.documentId(), 'in', plantIds)
      .get();

    // Mengembalikan daftar tumbuhan yang disimpan
    const savedPlants = plantsSnapshot.docs.map(doc => doc.data());

    res.status(200).json({ data: savedPlants });
  } catch (error) {
    console.error('Error getting saved plants:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = {
  registerHandler,
  loginHandler,
  logoutHandler,
  verifyToken,
  verifyTokenExpiry,
  getPlantById,
  getSavedPlants,
  savePlant
};
