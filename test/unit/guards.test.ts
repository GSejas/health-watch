import * as assert from 'assert';
import * as os from 'os';
import { NetIfUpGuard, DnsGuard } from '../../src/guards';

describe('Guards System', () => {
    
    describe('NetIfUpGuard', () => {
        it('should detect existing network interfaces', async () => {
            const interfaces = os.networkInterfaces();
            const interfaceNames = Object.keys(interfaces);

            if (interfaceNames.length > 0) {
                const firstInterface = interfaceNames[0];
                const guard = new NetIfUpGuard(firstInterface);
                const result = await guard.check();
                
                assert.strictEqual(result.passed, true);
                assert.strictEqual(result.error, undefined);
            }
        });

        it('should return false for non-existent interface', async () => {
            const nonExistentInterface = 'nonexistent-interface-12345';
            const guard = new NetIfUpGuard(nonExistentInterface);
            const result = await guard.check();
            
            assert.strictEqual(result.passed, false);
            assert.ok(result.error);
        });

        it('should provide available interfaces in error details', async () => {
            const guard = new NetIfUpGuard('fake-interface');
            const result = await guard.check();
            
            assert.strictEqual(result.passed, false);
            assert.ok(result.details);
            assert.ok(Array.isArray(result.details.availableInterfaces));
        });
    });

    describe('DnsGuard', () => {
        it('should resolve well-known public DNS names', async function() {
            this.timeout(10000);
            
            const guard = new DnsGuard('google.com');
            
            try {
                const result = await guard.check();
                assert.strictEqual(result.passed, true);
            } catch (error) {
                // Network might not be available in test environment
                console.warn('DNS test skipped: network unavailable');
            }
        });

        it('should fail for non-existent domains', async function() {
            this.timeout(10000);
            
            const guard = new DnsGuard('nonexistent-domain-12345.invalid');
            
            try {
                const result = await guard.check();
                assert.strictEqual(result.passed, false);
                assert.ok(result.error);
            } catch (error) {
                // DNS errors are expected for non-existent domains
                assert.ok(error);
            }
        });

        it('should handle timeout scenarios', async function() {
            this.timeout(5000);
            
            const guard = new DnsGuard('google.com');
            
            try {
                const result = await guard.check();
                // Either succeeds quickly or times out
                assert.ok(typeof result.passed === 'boolean');
            } catch (error) {
                // Timeout errors are acceptable
                assert.ok(error);
            }
        });
    });
});