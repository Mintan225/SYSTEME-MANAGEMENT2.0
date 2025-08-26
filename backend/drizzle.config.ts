import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

// Condition pour vérifier si l'on est sur Render et activer SSL
const isRender = process.env.DATABASE_URL?.includes('render.com');
const dbUrl = isRender ? `${process.env.DATABASE_URL}?ssl=true` : process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared-types/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: dbUrl!,
  },
  verbose: true,
  strict: true
});