// server.js or app.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

// Use an SQLite database
const database = new sqlite3.Database(":memory:");

const initializeDbAndServer = async () => {
  try {
    await database.run(`
      CREATE TABLE IF NOT EXISTS "transaction" (
        id INTEGER PRIMARY KEY,
        title TEXT,
        price REAL,
        description TEXT,
        category TEXT,
        image TEXT,
        sold INTEGER,
        dateOfSale TEXT
      );
    `);
    console.log("Database initialized successfully");

    // Delay the data retrieval to ensure database creation is completed
    setTimeout(() => {
      getData("https://s3.amazonaws.com/roxiler.com/product_transaction.json");
    }, 5000);
  } catch (error) {
    console.error(error);
  }
};

initializeDbAndServer();

async function getData(url) {
  try {
    const { data } = await axios.get(url);
    data.forEach((d) => {
      console.log("Inserting data:", d);

      let sql = `INSERT INTO "transaction"(id,title,price,description,category,image,sold,dateOfSale) VALUES(?,?,?,?,?,?,?,?)`;

      try {
        database.run(sql, [
          d.id,
          d.title,
          d.price,
          d.description,
          d.category,
          d.image,
          d.sold,
          d.dateOfSale,
        ]);
      } catch (error) {
        console.error("Error inserting data:", error);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

app.get("/api/initialize-database", async (req, res) => {
  try {
    const response = await axios.get(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    const transactionsData = response.data;
    res.json({ message: "Database initialized successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/transactions", async (req, res) => {
  const { month, page = 1, perPage = 10, searchText } = req.query;
  console.log("Fetching transactions for month:", month);
  let filteredTransactions = await database.all(
    `
      SELECT * FROM "transaction"
      WHERE dateOfSale LIKE ? AND (
        ? OR title LIKE ? OR description LIKE ? OR price LIKE ?
      )
      LIMIT ? OFFSET ?
    `,
    [
      `${month}%`,
      !searchText,
      `%${searchText}%`,
      `%${searchText}%`,
      `%${searchText}%`,
      perPage,
      (page - 1) * perPage,
    ]
  );
  console.log("Filtered transactions:", filteredTransactions);

  let total = await database.get(
    `
    SELECT COUNT(*) as total FROM "transaction"
    WHERE dateOfSale LIKE ? AND (
      ? OR title LIKE ? OR description LIKE ? OR price LIKE ?
    )
  `,
    [
      `${month}%`,
      !searchText,
      `%${searchText}%`,
      `%${searchText}%`,
      `%${searchText}%`,
    ]
  );
  console.log("Total transactions:", total);
  res.json({ transactions: filteredTransactions, total: total.total });
});

app.get("/api/statistics", async (req, res) => {
  const { month } = req.query;

  const totalSaleAmount = await database.get(
    `
    SELECT IFNULL(SUM(price), 0) as totalSaleAmount FROM "transaction"
    WHERE dateOfSale LIKE ?
  `,
    [`${month}%`]
  );

  const totalSoldItems = await database.get(
    `
    SELECT COUNT(*) as totalSoldItems FROM "transaction"
    WHERE dateOfSale LIKE ?
  `,
    [`${month}%`]
  );

  const totalNotSoldItems = await database.get(
    `
    SELECT COUNT(*) as totalNotSoldItems FROM "transaction"
    WHERE NOT dateOfSale LIKE ?
  `,
    [`${month}%`]
  );

  res.json({
    totalSaleAmount: totalSaleAmount.totalSaleAmount,
    totalSoldItems: totalSoldItems.totalSoldItems,
    totalNotSoldItems: totalNotSoldItems.totalNotSoldItems,
  });
});

app.get("/api/bar-chart", async (req, res) => {
  const { month } = req.query;

  const priceRanges = [
    { min: 0, max: 100 },
    { min: 101, max: 200 },
    { min: 201, max: 300 },
    { min: 301, max: 400 },
    { min: 401, max: 500 },
    { min: 501, max: 600 },
    { min: 601, max: 700 },
    { min: 701, max: 800 },
    { min: 801, max: 900 },
    { min: 901, max: Infinity },
  ];

  const barChartData = await Promise.all(
    priceRanges.map(async (range) => {
      const numItems = await database.get(
        `
      SELECT IFNULL(COUNT(*), 0) as numItems FROM "transaction"
      WHERE dateOfSale LIKE ? AND price >= ? AND price <= ?
    `,
        [`${month}%`, range.min, range.max]
      );

      return {
        priceRange: `${range.min} - ${range.max}`,
        numItems: numItems.numItems,
      };
    })
  );

  res.json(barChartData);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
