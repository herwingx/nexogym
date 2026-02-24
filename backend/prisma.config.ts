import { defineConfig } from "prisma/config";
import * as dotenv from 'dotenv';

dotenv.config({ path: 'prisma/.env' });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
