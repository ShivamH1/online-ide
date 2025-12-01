import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { initWs } from "./ws";

dotenv.config();
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(cors());
const httpServer = createServer(app);

initWs(httpServer);

httpServer.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
