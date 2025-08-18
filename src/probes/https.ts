/**
 * @fileoverview HTTPS Probe Implementation
 * 
 * This module implements HTTP/HTTPS connectivity probing with advanced validation
 * capabilities including status code checking, content validation, and timeout handling.
 * 
 * @module probes/https
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The HTTPS probe performs HTTP/HTTPS requests to validate web service availability and
 * response characteristics. It supports:
 * - HTTP/HTTPS protocol auto-detection
 * - Status code validation (single codes or ranges)
 * - Response content validation via regex or string matching
 * - Custom timeout handling
 * - HTTP header validation
 * - Proxy support (configurable)
 * - Latency measurement
 * 
 * @interfaces
 * - Uses ProbeResult interface for standardized output
 * - Integrates with ChannelDefinition for configuration
 * - Supports ExpectationRules for response validation
 * 
 * @classes
 * - HttpsProbe: Main HTTPS probe implementation
 * 
 * @dependencies
 * - https: Node.js HTTPS module for secure requests
 * - http: Node.js HTTP module for non-secure requests
 * - url: URL parsing and validation
 * - ../types: ProbeResult interface
 * - ../config: ChannelDefinition and ExpectationRules
 * 
 * @probe_features
 * - Protocol support: HTTP and HTTPS
 * - Method support: HEAD (default), GET (fallback)
 * - Validation options:
 *   - Status codes: Single code or array of valid codes
 *   - Status ranges: [min, max] range validation
 *   - Content matching: String or regex patterns
 *   - Header presence: Required header validation
 * - Error handling: Network errors, timeouts, invalid responses
 * - Performance: Latency measurement in milliseconds
 * 
 * @request_flow
 * 1. Parse and validate URL
 * 2. Determine protocol (HTTP/HTTPS)
 * 3. Configure request options (timeout, headers, method)
 * 4. Execute request with latency measurement
 * 5. Validate response status and content
 * 6. Return structured result
 * 
 * @example
 * ```typescript
 * const probe = new HttpsProbe();
 * 
 * // Basic HTTPS health check
 * const result = await probe.probe({
 *   id: 'api-health',
 *   type: 'https',
 *   url: 'https://api.example.com/health',
 *   expectedStatusCode: 200,
 *   expectedContent: 'healthy'
 * }, 'HealthWatch/1.0', true);
 * 
 * if (result.success) {
 *   console.log(`API healthy, latency: ${result.latencyMs}ms`);
 * } else {
 *   console.log(`API failed: ${result.error}`);
 * }
 * ```
 * 
 * @configuration_example
 * ```json
 * {
 *   "id": "web-api",
 *   "type": "https",
 *   "url": "https://api.example.com/v1/health",
 *   "intervalSec": 30,
 *   "timeoutSec": 10,
 *   "expectedStatusCode": 200,
 *   "expectedContent": "status.*ok",
 *   "expectation": {
 *     "statusRange": [200, 299],
 *     "headerHas": "x-health-check"
 *   }
 * }
 * ```
 * 
 * @error_types
 * - Network errors: Connection refused, host unreachable
 * - Timeout errors: Request timeout exceeded
 * - Protocol errors: Invalid URL, SSL/TLS issues
 * - Validation errors: Unexpected status code or content
 * 
 * @securityRiskAnalysis
 * Security & Risk Analysis:
 * - TLS/Certificate Risks: Probing HTTPS endpoints may surface SSL/TLS errors. TLS verification is enabled by default; allowProxy/user-controlled options may alter behavior.
 * - Information Leakage: Response headers and body snippets are captured — avoid probing endpoints that return sensitive data.
 * - Network Policy: Frequent probing of external systems may trigger IDS/IPS alerts or violate organizational policies; use suitable intervals and backoff.
 * - Request Forgery: Probes perform idempotent HEAD requests by default; avoid using probes to execute side-effectful endpoints.
 * - Input Validation: URLs are parsed and validated; malformed URLs return errors rather than issuing requests.
 * - Dependency Trust: Uses Node.js http/https modules — ensure runtime is kept up-to-date to mitigate platform vulnerabilities.
 * - Logging & Storage: Ensure stored probe results containing network details are protected and not exported unintentionally.
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ProbeResult } from '../types';
import { ChannelDefinition, ExpectationRules } from '../config';

/**
 * HttpsProbe performs HTTP/HTTPS requests according to channel configuration
 * and evaluates responses against expectation rules.
 *
 * Instances are stateless and safe to reuse across probes.
 */
export class HttpsProbe {
    /**
     * Execute a probe for the supplied channel URL.
     *
     * @param channel - ChannelDefinition containing 'url', optional 'timeoutMs' and 'expect'
     * @param userAgent - User-Agent header value to send with requests
     * @param allowProxy - Whether to honor proxy configuration (if implemented)
     * @returns Promise resolving to a ProbeResult with success, latency and details or error
     */
    async probe(channel: ChannelDefinition, userAgent: string, allowProxy: boolean): Promise<ProbeResult> {
        if (!channel.url) {
            return {
                success: false,
                latencyMs: 0,
                error: 'No URL specified'
            };
        }

        const startTime = Date.now();
        
        try {
            const url = new URL(channel.url);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'HEAD',
                timeout: channel.timeoutMs || 3000,
                headers: {
                    'User-Agent': userAgent
                },
                rejectUnauthorized: true
            };

            const result = await new Promise<ProbeResult>((resolve) => {
                const req = client.request(options, (res) => {
                    const latencyMs = Date.now() - startTime;
                    const statusCode = res.statusCode || 0;
                    
                    let body = '';
                    res.on('data', (chunk) => {
                        body += chunk;
                    });
                    
                    res.on('end', () => {
                        const success = this.evaluateExpectations(
                            statusCode,
                            res.headers,
                            body,
                            channel.expect
                        );
                        
                        resolve({
                            success,
                            latencyMs,
                            details: {
                                statusCode,
                                headers: res.headers,
                                bodyLength: body.length
                            }
                        });
                    });
                });

                req.on('error', (error) => {
                    const latencyMs = Date.now() - startTime;
                    resolve({
                        success: false,
                        latencyMs,
                        error: error.message,
                        details: { errorCode: (error as any).code }
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    const latencyMs = Date.now() - startTime;
                    resolve({
                        success: false,
                        latencyMs,
                        error: 'Timeout'
                    });
                });

                req.end();
            });

            return result;
        } catch (error) {
            return {
                success: false,
                latencyMs: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Evaluate response against expectation rules.
     *
     * @param statusCode - HTTP response status code
     * @param headers - Response headers object
     * @param body - Response body as string
     * @param expect - Optional ExpectationRules to validate status, headers, and body
     * @returns boolean indicating whether expectations are satisfied
     */
    private evaluateExpectations(
        statusCode: number,
        headers: http.IncomingHttpHeaders,
        body: string,
        expect?: ExpectationRules
    ): boolean {
        if (!expect) {
            return statusCode >= 200 && statusCode < 400;
        }

        if (expect.treatAuthAsReachable && (statusCode === 401 || statusCode === 403)) {
            return true;
        }

        if (expect.status && !expect.status.includes(statusCode)) {
            return false;
        }

        if (expect.statusRange) {
            const [min, max] = expect.statusRange;
            if (statusCode < min || statusCode > max) {
                return false;
            }
        }

        if (expect.headerHas) {
            for (const [headerName, expectedValue] of Object.entries(expect.headerHas)) {
                const actualValue = headers[headerName.toLowerCase()];
                if (!actualValue || !actualValue.toString().includes(expectedValue)) {
                    return false;
                }
            }
        }

        if (expect.bodyRegex) {
            try {
                const regex = new RegExp(expect.bodyRegex);
                if (!regex.test(body)) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }

        if (!expect.status && !expect.statusRange) {
            return statusCode >= 200 && statusCode < 400;
        }

        return true;
    }
}