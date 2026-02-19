const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage for PDFs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Databases
const BOOKS_FILE = './books.json';
const USERS_FILE = './users.json';

let books = [];
if (fs.existsSync(BOOKS_FILE)) {
    books = JSON.parse(fs.readFileSync(BOOKS_FILE));
}

let users = [];
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE));
} else {
    // Initial Admin User
    users = [{
        id: "1",
        username: "Blossom",
        password: "mihle123",
        email: "admin@blossom.com",
        role: "ADMIN",
        progress: {} // { bookId: progressPercentage }
    }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const saveBooks = () => fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

// --- API Endpoints ---

// 1. Auth: Register
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).send('Missing fields');

    if (users.find(u => u.username === username)) {
        return res.status(400).send('Username already exists');
    }

    const newUser = {
        id: Date.now().toString(),
        username,
        password, // In real apps, hash this!
        email,
        role: "USER",
        progress: {}
    };

    users.push(newUser);
    saveUsers();

    // Return user without password
    const { password: _, ...userResponse } = newUser;
    res.status(201).json(userResponse);
});

// 2. Auth: Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.status(401).send('Invalid credentials');

    const { password: _, ...userResponse } = user;
    res.json(userResponse);
});

// 3. Admin: Get All Users
app.get('/api/users', (req, res) => {
    // In real app, check if requester is admin
    const userSummary = users.map(u => {
        const { password: _, ...safeUser } = u;
        return safeUser;
    });
    res.json(userSummary);
});

// 4. Progress: Update Reading Progress
app.post('/api/users/progress', (req, res) => {
    const { userId, bookId, progress } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).send('User not found');

    // Merge or set progress
    if (typeof progress === 'object') {
        user.progress[bookId] = {
            ...(user.progress[bookId] || {}),
            ...progress,
            lastReadTimestamp: Date.now()
        };
    } else {
        // Fallback for simple percentage
        user.progress[bookId] = {
            ...(user.progress[bookId] || {}),
            percentage: progress,
            lastReadTimestamp: Date.now()
        };
    }

    saveUsers();
    res.sendStatus(200);
});

// 5. Visits: Track App Opening
app.post('/api/users/visit', (req, res) => {
    const { userId } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).send('User not found');

    user.appOpenCount = (user.appOpenCount || 0) + 1;
    user.lastVisitTimestamp = Date.now();

    saveUsers();
    res.sendStatus(200);
});

// 6. Books: Get All
app.get('/api/books', (req, res) => {
    res.json(books);
});

// 6. Books: Upload
app.post('/api/books/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded');

    const newBook = {
        id: Date.now().toString(),
        title: req.body.title || 'Untitled',
        author: req.body.author || 'Unknown',
        downloadUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        uploadDate: Date.now(),
        uploadedBy: 'admin',
        isRemote: true,
        filePath: ""
    };

    books.push(newBook);
    saveBooks();
    res.status(201).json(newBook);
});

// 7. Books: Delete
app.delete('/api/books/:id', (req, res) => {
    const bookIndex = books.findIndex(b => b.id === req.params.id);
    if (bookIndex === -1) return res.status(404).send('Not found');

    const book = books[bookIndex];
    const fileName = book.downloadUrl.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    books.splice(bookIndex, 1);
    saveBooks();
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Blossom Server running with User Support on port ${PORT}`);
});
