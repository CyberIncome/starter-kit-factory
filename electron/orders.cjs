const fs = require('node:fs/promises');
const path = require('node:path');

const ordersFile = (userDataPath) => path.join(userDataPath, 'orders.json');

async function readOrders(userDataPath) {
  try { return JSON.parse(await fs.readFile(ordersFile(userDataPath), 'utf8')); }
  catch { return []; }
}

async function saveOrder(userDataPath, order) {
  const kept = (await readOrders(userDataPath)).filter((item) => item.id !== order.id);
  kept.unshift(order);
  await fs.writeFile(ordersFile(userDataPath), JSON.stringify(kept.slice(0, 100), null, 2));
}

module.exports = { readOrders, saveOrder };
