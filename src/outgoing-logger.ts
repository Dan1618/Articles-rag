import { Logger } from '@nestjs/common';
import http from 'http';
import https from 'https';

const logger = new Logger('OutgoingHTTP');

export function patchFetchForLogging() {
    // Guard against double patching
    if ((globalThis.fetch as any)?._isPatched) {
        return;
    }

    // --- 1. Patch Global Fetch ---
    const originalFetch = globalThis.fetch;
    if (originalFetch) {
        globalThis.fetch = async (
            input: string | URL | globalThis.Request,
            init?: RequestInit,
        ): Promise<Response> => {
            const start = Date.now();
            let url: string;
            let method: string = init?.method || 'GET';

            if (typeof input === 'string') {
                url = input;
            } else if (input instanceof URL) {
                url = input.toString();
            } else {
                url = input.url;
                method = input.method || method;
            }

            try {
                const response = await originalFetch(input, init);
                const delay = Date.now() - start;
                logger.log(`${method.toUpperCase()} ${url} ${response.status} +${delay}ms (fetch)`);
                return response;
            } catch (error) {
                const delay = Date.now() - start;
                logger.error(
                    `${method.toUpperCase()} ${url} +${delay}ms (fetch) ERROR: ${error.message}`,
                );
                throw error;
            }
        };
        (globalThis.fetch as any)._isPatched = true;
    }

    // --- 2. Patch HTTP/HTTPS modules ---
    const patchRequest = (module: any, protocol: string) => {
        if (!module || module._isPatchedForLogging) return;

        try {
            const originalRequest = module.request;
            const patchedRequest = function (...args: any[]) {
                const start = Date.now();
                let options = args[0];

                let url: string;
                if (typeof options === 'string') {
                    url = options;
                } else if (options instanceof URL) {
                    url = options.toString();
                } else {
                    const host = options.hostname || options.host || 'localhost';
                    const port =
                        options.port && options.port !== 80 && options.port !== 443
                            ? `:${options.port}`
                            : '';
                    const path = options.path || '/';
                    url = `${protocol}://${host}${port}${path}`;
                }

                const method = (options.method || 'GET').toUpperCase();

                const req = originalRequest.apply(this, args);

                req.on('response', (res: any) => {
                    const delay = Date.now() - start;
                    logger.log(
                        `${method} ${url} ${res.statusCode} +${delay}ms (${protocol})`,
                    );
                });

                req.on('error', (err: any) => {
                    const delay = Date.now() - start;
                    logger.error(
                        `${method} ${url} +${delay}ms (${protocol}) ERROR: ${err.message}`,
                    );
                });

                return req;
            };

            // Try to set it directly, fall back to defineProperty if it's a getter
            try {
                module.request = patchedRequest;
            } catch (e) {
                Object.defineProperty(module, 'request', {
                    value: patchedRequest,
                    configurable: true,
                    writable: true,
                });
            }

            module._isPatchedForLogging = true;
        } catch (err: any) {
            logger.warn(`Failed to patch ${protocol} module: ${err.message}`);
        }
    };

    patchRequest(http, 'http');
    patchRequest(https, 'https');
}
