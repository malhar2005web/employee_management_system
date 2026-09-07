import localtunnel from 'localtunnel';

async function startTunnel() {
    try {
        const tunnel = await localtunnel({ port: 5008, subdomain: 'planex-waba-bot-6781' });

        console.log(`\n========================================`);
        console.log(`🚀 PERMANENT TUNNEL ACTIVE!`);
        console.log(`🔗 Webhook URL: ${tunnel.url}/api/v1/whatsapp/webhook`);
        console.log(`========================================\n`);

        tunnel.on('close', () => {
            console.log('Tunnel closed. Reconnecting in 3s...');
            setTimeout(startTunnel, 3000);
        });

        tunnel.on('error', (err) => {
            console.error('Tunnel error:', err);
        });
    } catch (err) {
        console.error('Failed to start tunnel:', err.message);
        setTimeout(startTunnel, 3000);
    }
}

startTunnel();
