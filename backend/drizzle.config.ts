import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

// Condition pour vérifier si l'on est sur Render et activer SSL
const isRender = process.env.DATABASE_URL?.includes('render.com');

export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared-types/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // Move the SSL configuration inside the dbCredentials object
    ssl: isRender ? { rejectUnauthorized: false } : undefined,
  },
  verbose: true,
  strict: true
});