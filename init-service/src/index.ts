import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { copyS3Folder } from "./aws";

const PORT = process.env.PORT || 3000;
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.post("/project", async (req: Request, res: Response) => {
  const { replId, language } = req.body;

  if (!replId || !language) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  await copyS3Folder(`base/${language}`, `code/${replId}`, "");

  res.status(201).send({ message: "Project created successfully" });
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
