import * as dns from 'dns';
import { promisify } from 'util';
import { ProbeResult } from '../types';
import { ChannelDefinition } from '../config';

export class DnsProbe {
    private resolver: dns.Resolver;
    private resolveMethods: Map<string, Function>;

    constructor() {
        this.resolver = new dns.Resolver();
        
        this.resolveMethods = new Map([
            ['A', promisify(this.resolver.resolve4.bind(this.resolver)) as unknown as (hostname: string) => Promise<string[]>],
            ['AAAA', promisify(this.resolver.resolve6.bind(this.resolver)) as unknown as (hostname: string) => Promise<string[]>],
            ['CNAME', promisify(this.resolver.resolveCname.bind(this.resolver)) as unknown as (hostname: string) => Promise<string[]>],
            ['MX', promisify(this.resolver.resolveMx.bind(this.resolver)) as unknown as (hostname: string) => Promise<string[]>],
            ['TXT', promisify(this.resolver.resolveTxt.bind(this.resolver)) as unknown as (hostname: string) => Promise<string[]>]
        ]);
    }

    async probe(channel: ChannelDefinition): Promise<ProbeResult> {
        if (!channel.hostname) {
            return {
                success: false,
                latencyMs: 0,
                error: 'No hostname specified'
            };
        }

        const recordType = channel.recordType || 'A';
        const resolveMethod = this.resolveMethods.get(recordType);

        if (!resolveMethod) {
            return {
                success: false,
                latencyMs: 0,
                error: `Unsupported record type: ${recordType}`
            };
        }

        const startTime = Date.now();
        const timeout = channel.timeoutMs || 3000;

        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('DNS resolution timeout')), timeout);
            });

            const resolvePromise = resolveMethod(channel.hostname);
            const records = await Promise.race([resolvePromise, timeoutPromise]);
            
            const latencyMs = Date.now() - startTime;
            
            return {
                success: true,
                latencyMs,
                details: {
                    hostname: channel.hostname,
                    recordType,
                    records: Array.isArray(records) ? records : [records],
                    recordCount: Array.isArray(records) ? records.length : 1
                }
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            const err = error as NodeJS.ErrnoException;
            
            return {
                success: false,
                latencyMs,
                error: err.message,
                details: {
                    hostname: channel.hostname,
                    recordType,
                    errorCode: err.code,
                    errno: err.errno
                }
            };
        }
    }

    setCustomDnsServers(servers: string[]) {
        this.resolver.setServers(servers);
    }

    resetDnsServers() {
        this.resolver = new dns.Resolver();
        this.resolveMethods.set('A', promisify(this.resolver.resolve4.bind(this.resolver)));
        this.resolveMethods.set('AAAA', promisify(this.resolver.resolve6.bind(this.resolver)));
        this.resolveMethods.set('CNAME', promisify(this.resolver.resolveCname.bind(this.resolver)));
        this.resolveMethods.set('MX', promisify(this.resolver.resolveMx.bind(this.resolver)));
        this.resolveMethods.set('TXT', promisify(this.resolver.resolveTxt.bind(this.resolver)));
    }
}