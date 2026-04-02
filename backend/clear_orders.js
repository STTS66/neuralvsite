const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.run("DELETE FROM orders", function (err) {
    if (err) {
        console.error(err.message);
    } else {
        console.log(`Row(s) deleted: ${this.changes}`);
    }
    db.close();
});
