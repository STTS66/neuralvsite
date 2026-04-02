const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.all("SELECT id, username, email, display_name FROM users", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.table(rows);
    });
});

db.close();
