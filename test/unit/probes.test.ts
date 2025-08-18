import * as assert from 'assert';
import { HttpsProbe } from '../../src/probes/https';
import { TcpProbe } from '../../src/probes/tcp';
import { DnsProbe } from '../../src/probes/dns';
import { ScriptProbe } from '../../src/probes/script';

// Mock channel interface based on the actual probe calls
interface TestChannel {
    id: string;
    name: string;
    type: string;
    url?: string;
    hostname?: string;
    port?: number;
    script?: string;
    timeoutMs?: number;
    expectedContent?: string;
    expectedStatusCode?: number;
    dnsRecordType?: string;
}

describe('Probe Tests', () => {
    
    describe('HttpsProbe', () => {
        let probe: HttpsProbe;

        beforeEach(() => {
            probe = new HttpsProbe();
        });

        it('should handle valid HTTPS URL', async () => {
            const channel: TestChannel = {
                id: 'test-https',
                name: 'Test HTTPS',
                type: 'https',
                url: 'https://httpbin.org/status/200'
            };

            const result = await probe.probe(channel as any, 'test-agent', true);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.latencyMs >= 0);
            assert.strictEqual(result.error, undefined);
        }).timeout(10000);

        it('should handle HTTP error status', async () => {
            const channel: TestChannel = {
                id: 'test-404',
                name: 'Test 404',
                type: 'https',
                url: 'https://httpbin.org/status/404'
            };

            const result = await probe.probe(channel as any, 'test-agent', true);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error);
        }).timeout(10000);
    });

    describe('TcpProbe', () => {
        let probe: TcpProbe;

        beforeEach(() => {
            probe = new TcpProbe();
        });

        it('should connect to open port', async () => {
            const channel: TestChannel = {
                id: 'test-tcp',
                name: 'Test TCP',
                type: 'tcp',
                hostname: 'httpbin.org',
                port: 80
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.latencyMs >= 0);
        }).timeout(10000);

        it('should fail on missing hostname', async () => {
            const channel: TestChannel = {
                id: 'test-tcp-incomplete',
                name: 'Test TCP Incomplete',
                type: 'tcp'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('required'));
        });
    });

    describe('DnsProbe', () => {
        let probe: DnsProbe;

        beforeEach(() => {
            probe = new DnsProbe();
        });

        it('should resolve A record', async () => {
            const channel: TestChannel = {
                id: 'test-dns',
                name: 'Test DNS',
                type: 'dns',
                hostname: 'google.com',
                dnsRecordType: 'A'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.latencyMs >= 0);
        }).timeout(10000);

        it('should fail on missing hostname', async () => {
            const channel: TestChannel = {
                id: 'test-dns-incomplete',
                name: 'Test DNS Incomplete',
                type: 'dns'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('required'));
        });
    });

    describe('ScriptProbe', () => {
        let probe: ScriptProbe;

        beforeEach(() => {
            probe = new ScriptProbe();
        });

        it('should execute successful script', async () => {
            const channel: TestChannel = {
                id: 'test-script',
                name: 'Test Script',
                type: 'script',
                script: 'echo "test"'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.latencyMs >= 0);
        }).timeout(5000);

        it('should handle script failure', async () => {
            const channel: TestChannel = {
                id: 'test-script-failure',
                name: 'Test Script Failure',
                type: 'script',
                script: 'exit 1'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error);
        }).timeout(5000);

        it('should fail on missing script', async () => {
            const channel: TestChannel = {
                id: 'test-script-incomplete',
                name: 'Test Script Incomplete',
                type: 'script'
            };

            const result = await probe.probe(channel as any);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('required'));
        });
    });
});