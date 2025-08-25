
const { drizzle } = require('drizzle-orm/postgres-js');
const { tables } = require('./shared/schema');
const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password@helium/heliumdb?sslmode=disable";

async function fixQRCodes() {
  const sql = postgres(DATABASE_URL);
  const db = drizzle(sql);

  try {
    console.log("🔄 Correction des QR codes pour utiliser le format /menu/...");
    
    const allTables = await db.select().from(tables);
    console.log(`Trouvé ${allTables.length} tables à corriger`);
    
    for (const table of allTables) {
      const newQRCode = `https://systeme-management2-0.onrender.com/menu/${table.number}`;
      
      await db.update(tables)
        .set({ qrCode: newQRCode })
        .where(eq(tables.id, table.id));
        
      console.log(`✅ Table ${table.number}: QR code mis à jour vers ${newQRCode}`);
    }
    
    console.log("🎉 Tous les QR codes ont été corrigés!");
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction des QR codes:", error);
  } finally {
    await sql.end();
  }
}

fixQRCodes().catch(console.error);
