/**
 * E2E Test Runner Entry Point
 * 
 * Configures and runs all end-to-end tests for the Health Watch extension.
 */

import * as path from 'path';
import { glob } from 'glob';

export async function run(): Promise<void> {
    const testsRoot = path.resolve(__dirname, '..');

    try {
        const files = await glob('**/**.test.js', { cwd: testsRoot });
        
        // Run each test file
        for (const file of files) {
            console.log(`Running test file: ${file}`);
            await import(path.resolve(testsRoot, file));
        }
        
        console.log('All E2E tests completed');
    } catch (error) {
        console.error('E2E tests failed:', error);
        throw error;
    }
}