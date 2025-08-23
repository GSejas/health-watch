/**
 * VS Code Extension Test Entry Point
 * 
 * Sets up Mocha globals and discovers test files for VS Code test environment.
 */

import * as path from 'path';
import { glob } from 'glob';
import Mocha from 'mocha';

export function run(): Promise<void> {
    // Create Mocha instance for VS Code test environment
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise(async (resolve, reject) => {
        try {
            console.log('VS Code test runner: Setting up Mocha...');
            
            // Find only E2E test files to avoid mixing test types
            const files = await glob('**/e2e/*.test.js', { cwd: testsRoot });
            console.log(`Found ${files.length} E2E test files:`, files);

            // Add each test file to Mocha
            for (const file of files) {
                const fullPath = path.resolve(testsRoot, file);
                console.log(`Adding test file: ${fullPath}`);
                mocha.addFile(fullPath);
            }

            // Run Mocha within VS Code test environment
            console.log('Running Mocha tests...');
            mocha.run((failures) => {
                if (failures > 0) {
                    console.error(`❌ ${failures} test(s) failed`);
                    reject(new Error(`${failures} tests failed`));
                } else {
                    console.log('✅ All tests passed');
                    resolve();
                }
            });
        } catch (error) {
            console.error('Failed to setup or run tests:', error);
            reject(error);
        }
    });
}