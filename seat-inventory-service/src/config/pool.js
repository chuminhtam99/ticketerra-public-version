const mysql = require("mysql2/promise");

const pool = mysql.createPool({

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

module.exports = pool;
