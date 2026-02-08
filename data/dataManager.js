import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "data.json");

/* ==========================
   Funções internas
========================== */

function readDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ clients: [], fibers: [] }, null, 2)
    );
  }

  const data = fs.readFileSync(dbPath, "utf-8");
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

/* ==========================
   CLIENTES
========================== */

export function getClients() {
  const db = readDB();
  return db.clients;
}

export function addClient(client) {
  const db = readDB();

  const newClient = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...client,
  };

  db.clients.push(newClient);
  writeDB(db);

  return newClient;
}

export function updateClient(id, data) {
  const db = readDB();

  const index = db.clients.findIndex(c => c.id === id);
  if (index === -1) return null;

  db.clients[index] = {
    ...db.clients[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  return db.clients[index];
}

/* ==========================
   FIBRAS
========================== */

export function getFibers() {
  const db = readDB();
  return db.fibers;
}

export function addFiber(fiber) {
  const db = readDB();

  const newFiber = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...fiber,
  };

  db.fibers.push(newFiber);
  writeDB(db);

  return newFiber;
}

export function updateFiber(id, data) {
  const db = readDB();

  const index = db.fibers.findIndex(f => f.id === id);
  if (index === -1) return null;

  db.fibers[index] = {
    ...db.fibers[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  return db.fibers[index];
}

/* ==========================
   DELETE (opcional)
========================== */

export function deleteFiber(id) {
  const db = readDB();
  db.fibers = db.fibers.filter(f => f.id !== id);
  writeDB(db);
}

export function deleteClient(id) {
  const db = readDB();
  db.clients = db.clients.filter(c => c.id !== id);
  writeDB(db);
}