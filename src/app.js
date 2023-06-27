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

server.post("/participants", async (req, res)=> {
 
});

server.get("/participants", async (req, res) => {
   
});

server.post("/messages", async (req, res) => {

});

server.get("/messages", async (req, res) => {

});

server.post("/status", async (req, res) => {

});

server.delete("/messages/:id", async (req, res) => {

});

server.put("/messages/:id", async (req, res) => {

});

server.listen(PORT, () => console.log(`Server Online! PORT: ${PORT}`));