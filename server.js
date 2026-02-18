const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.set('trust proxy', 1); // Trust Render's proxy to get correct https protocol
const PORT = process.env.PORT || 3000;

// Configuration
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

// "Database" (JSON file for persistence on the server)
const DATA_FILE = './books.json';
let books = [];
if (fs.existsSync(DATA_FILE)) {
    books = JSON.parse(fs.readFileSync(DATA_FILE));
}

const saveToDisk = () => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(books, null, 2));
};

// --- API Endpoints ---

// 1. Get All Books
app.get('/api/books', (req, res) => {
    res.json(books);
});

// 2. Upload Book
app.post('/api/books/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded');

    const newBook = {
        id: Date.now().toString(),
        title: req.body.title || 'Untitled',
        author: req.body.author || 'Unknown',
        // In production, this would be your real domain (e.g. blossom-app.render.com)
        downloadUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        uploadDate: Date.now(),
        uploadedBy: 'admin',
        isRemote: true,
        filePath: "" // Empty on server, app will fill this when downloaded
    };

    books.push(newBook);
    saveToDisk();
    res.status(201).json(newBook);
});

// 3. Delete Book
app.delete('/api/books/:id', (req, res) => {
    const bookIndex = books.findIndex(b => b.id === req.params.id);
    if (bookIndex === -1) return res.status(404).send('Not found');

    const book = books[bookIndex];
    // Delete file from disk
    const fileName = book.downloadUrl.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    books.splice(bookIndex, 1);
    saveToDisk();
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Blossom Server running on port ${PORT}`);
});
