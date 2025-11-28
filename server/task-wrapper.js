
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = JSON.parse(process.argv[2] || '{}');
const taskName = process.argv[3];

try {
  // Import dynamique de la tâche
  const taskModule = await import(`../balance-calculator/src/tasks/${taskName}.js`);
  const taskFunction = taskModule[`task${taskName}`];
  
  if (!taskFunction) {
    throw new Error(`Task function task${taskName} not found`);
  }

  // Exécuter la tâche avec les options
  const result = await taskFunction(options.tempData || '');
  
  const resultPath = join(__dirname, 'task-result.json');
  writeFileSync(resultPath, JSON.stringify({ 
    success: true, 
    outputFile: result || '',
    message: 'Task completed successfully'
  }));
  
  process.exit(0);
} catch (error) {
  const resultPath = join(__dirname, 'task-result.json');
  writeFileSync(resultPath, JSON.stringify({ 
    success: false, 
    error: error.message,
    stack: error.stack
  }));
  console.error('Task error:', error);
  process.exit(1);
}
