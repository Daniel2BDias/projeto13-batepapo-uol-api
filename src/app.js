import express, { json } from "express";
import cors from "cors";
import Joi from "joi";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";

const server = express();
const PORT = 5000;

server.use(cors());
server.use(json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

await mongoClient.connect();
const db = mongoClient.db();

const userSchema = Joi.object({
  name: Joi.string().alphanum().required(),
});

const messageSchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("message", "private_message").required(),
});

server.post("/participants", async (req, res) => {
  const { name } = req.body;

  const validation = userSchema.validate({ name });

  if (validation.error) return res.sendStatus(422);

  try {
    const alreadyInUse = await db.collection("participants").findOne({ name });

    if (alreadyInUse) return res.status(409).send("Nome de Usuário em Uso");

    await db
      .collection("participants")
      .insertOne({ name, LastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    res.status(500).send(console.log(error.message));
  }
});

server.get("/participants", async (req, res) => {
  try {
    const users = await db.collection("participants").find().toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.post("/messages", async (req, res) => {
  const { user } = req.headers;
  const { to, text, type } = req.body;

  const userLogged = await db
    .collection("participants")
    .findOne({ name: user });

  const validation = messageSchema.validate(req.body, { abortEarly: false });

  if (!user || !userLogged || validation.error) return res.sendStatus(422);

  try {
    const time = dayjs().format("HH:mm:ss");
    db.collection("messages").insertOne({ from: user, to, text, type, time });
    res.sendStatus(201);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.get("/messages", async (req, res) => {
  const { user } = req.headers;
  if (!user) return res.sendStatus(422);
  try {
    const messages = db
      .collection("messages")
      .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] });
    res.send(messages);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.post("/status", async (req, res) => {
  const { user } = req.headers;
  const userLogged = await db.collection("participants").findOne({name: user});

  if(!user || !userLogged) return res.sendStatus(404);
  try {
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { LastStatus: Date.now() }});
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.delete("/messages/:id", async (req, res) => {});

server.put("/messages/:id", async (req, res) => {});

//setInterval(() => {}, 15000);

server.listen(PORT, () => console.log(`Server Online! PORT: ${PORT}`));
