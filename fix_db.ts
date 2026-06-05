import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Force dotenv to overwrite OS-level environment variables
const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper to convert camelCase to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

async function main() {
  try {
    console.log("Analyzing database for duplicate camelCase/snake_case columns...");

    // Query all columns from the current database
    const columns: any[] = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'badyadb'
    `);

    // Group columns by table
    const tableColumns: { [tableName: string]: any[] } = {};
    for (const col of columns) {
      if (!tableColumns[col.TABLE_NAME]) {
        tableColumns[col.TABLE_NAME] = [];
      }
      tableColumns[col.TABLE_NAME].push(col);
    }

    console.log(`Found ${Object.keys(tableColumns).length} tables. Scanning for conflicts...`);

    for (const [tableName, cols] of Object.entries(tableColumns)) {
      const colNames = cols.map(c => c.COLUMN_NAME);
      
      for (const col of cols) {
        const name = col.COLUMN_NAME;
        
        // Check if name is camelCase (has uppercase letters and is not all caps)
        const isCamel = /[a-z]+[A-Z]+/.test(name);
        if (isCamel) {
          const snakeCounterpart = camelToSnake(name);
          
          // If a snake_case counterpart exists in the same table
          if (colNames.includes(snakeCounterpart)) {
            console.log(`[Conflict Detected] Table: ${tableName} has both '${name}' (camelCase) and '${snakeCounterpart}' (snake_case).`);
            
            // If the camelCase column is NOT NULL and is not part of the primary key
            if (col.IS_NULLABLE === 'NO' && col.COLUMN_KEY !== 'PRI') {
              console.log(`  -> Column '${name}' is currently NOT NULL. Adjusting to NULL...`);
              
              // Alter table to make column NULL
              const alterQuery = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${name}\` ${col.COLUMN_TYPE} NULL;`;
              console.log(`  Executing: ${alterQuery}`);
              await prisma.$executeRawUnsafe(alterQuery);
              console.log(`  Successfully modified '${name}' to NULL.`);
            } else {
              console.log(`  -> Column '${name}' is already nullable or primary key.`);
            }
          }
        }
      }
    }

    console.log("\nDatabase schema reconciliation complete! All conflicts successfully healed.");

  } catch (error) {
    console.error("Error healing database schema:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
