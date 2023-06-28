import express, { json } from "express";
import cors from "cors";
import Joi from "joi";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";

const server = express();
const PORT = 5000;

server.use(cors());
server.use(json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

await mongoClient.connect();
const db = mongoClient.db();

const userSchema = Joi.object({
  name: Joi.string().required(),
});

const messageSchema = Joi.object({
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("message", "private_message").required(),
});

server.post("/participants", async (req, res) => {
  const { name } = req.body;

  const validation = userSchema.validate(req.body);

  if (validation.error) return res.sendStatus(422);

  const sanitizedName = stripHtml(name).result.trim();
  try {
    const alreadyInUse = await db
      .collection("participants")
      .findOne({ name: sanitizedName });
    if (alreadyInUse) return res.status(409).send("Nome de Usuário em Uso");

    await db
      .collection("participants")
      .insertOne({ name: sanitizedName, lastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: sanitizedName,
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

  const sanitizedName = stripHtml(user).result.trim();
  const sanitizedText = stripHtml(text).result.trim();
  const sanitizedTo = stripHtml(to).result.trim();
  const sanitizedType = stripHtml(type).result.trim();

  try {
    const time = dayjs().format("HH:mm:ss");
    await db.collection("messages").insertOne({
      from: sanitizedName,
      to: sanitizedTo,
      text: sanitizedText,
      type: sanitizedType,
      time,
    });

    res.sendStatus(201);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const { limit } = req.query;

  const isLimitDefined =
    limit !== undefined && (limit <= 0 || limit != Number(limit));

  const isLogged = await db.collection("participants").findOne({ name: user });

  if (!user || !isLogged || isLimitDefined) return res.sendStatus(422);

  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] })
      .toArray();
    if (isLimitDefined) return res.send(messages.slice(0 - limit));

    res.send(messages);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.post("/status", async (req, res) => {
  const { user } = req.headers;

  const userLogged = await db
    .collection("participants")
    .findOne({ name: user });

  if (!user || !userLogged) return res.sendStatus(404);

  try {
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.delete("/messages/:id", async (req, res) => {
  const { user } = req.headers;
  const { id } = req.params;

  const messageExists = await db
    .collection("messages")
    .findOne({ _id: new ObjectId(id) });

  if (!messageExists) return res.sendStatus(404);

  if (messageExists.from !== user) return res.sendStatus(401);

  try {
    await db.collection("messages").deleteOne({ _id: new ObjectId(id) });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

server.put("/messages/:id", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;
  const { id } = req.params;

  const validation = messageSchema.validate(req.body, { abortEarly: false });
  const isLogged = await db.collection("participants").findOne({ name: user });

  if (!isLogged || validation.error) return res.sendStatus(422);

  const sanitizedTo = stripHtml(to).result.trim();
  const sanitizedText = stripHtml(text).result.trim();
  const sanitizedType = stripHtml(type).result.trim();

  const massageExists = await db
    .collection("messages")
    .findOne({ _id: new ObjectId(id) });

  if (!massageExists) return res.sendStatus(404);

  if (massageExists.from !== user) return res.sendStatus(401);

  try {
    await db
      .collection("messages")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { to: sanitizedTo, text: sanitizedText, type: sanitizedType } }
      );
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

setInterval(async () => {
  const status = await db.collection("participants").find().toArray();

  status.forEach(async ({ name, lastStatus }) => {
    if (lastStatus < Date.now() - 10000) {
      const time = dayjs().format("HH:mm:ss");
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time,
      });
      
      await db.collection("participants").deleteOne({ name });
    }
  });
}, 15000);

server.listen(PORT, () => console.log(`Server Online! PORT: ${PORT}`));