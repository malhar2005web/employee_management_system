// desktop.js - Desktop-specific JavaScript overrides and native integration mappings

const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url);
    
    // Normalize init and headers
    init = init || {};
    let headers = init.headers || {};
    
    // Attach authorization bearer token if present
    const token = localStorage.getItem('ems_jwt_token');
    if (token) {
        if (headers instanceof Headers) {
            headers.set('Authorization', `Bearer ${token}`);
        } else if (typeof headers === 'object') {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    init.headers = headers;
    
    // Rewrite relative URLs to point to localhost:5008
    if (typeof url === 'string') {
        if (url.startsWith('/api/')) {
            const rewritten = 'http://localhost:5008' + url;
            if (typeof input === 'string') {
                input = rewritten;
            } else {
                Object.defineProperty(input, 'url', { value: rewritten, writable: false });
            }
        } else if (url.includes('ems.local/api/')) {
            const rewritten = url.replace('https://ems.local', 'http://localhost:5008');
            if (typeof input === 'string') {
                input = rewritten;
            } else {
                Object.defineProperty(input, 'url', { value: rewritten, writable: false });
            }
        }
    }
    
    // Call the original fetch
    const response = await originalFetch(input, init);
    
    // Intercept login/logout responses to handle token lifecycle
    if (typeof url === 'string') {
        if (url.includes('/api/v1/auth/login')) {
            try {
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();
                if (data && data.success && data.token) {
                    localStorage.setItem('ems_jwt_token', data.token);
                    console.log("EMS Token stored in localStorage.");
                }
            } catch (e) {
                console.error("Failed to parse login response:", e);
            }
        } else if (url.includes('/api/v1/auth/logout')) {
            localStorage.removeItem('ems_jwt_token');
            console.log("EMS Token cleared from localStorage.");
        }
    }
    
    return response;
};

console.log("EMS Desktop Overrides Loaded (Fetch Token Tunnel Active)!");
