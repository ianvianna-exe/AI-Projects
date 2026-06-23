const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

async function connectWhatsApp(sessionId, onMessageReceived) {
    if (!sessionId) {
        console.error("[ERRO] É necessário informar um ID de sessão para iniciar o 'WhatsApp'.");
        process.exit(1);
    }

    const sessionPath = path.join(__dirname, 'whatsapp-sessions', `sessions-${sessionId}`);
    const sessionExists = fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            if (sessionExists) {
                console.log(`[AVISO] A sessão "${sessionId}" já existe, mas está desconectada.`);
            } else {
                console.log(`[NOVA SESSÃO] Gerando 'QR Code' para a sessão "${sessionId}":`);
            }

            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(`[WHATSAPP - ${sessionId}] Conexão encerrada. Reconectando: ${shouldReconnect}`);

            if (shouldReconnect) {
                connectWhatsApp(sessionId, onMessageReceived);
            } else {
                console.log(`[WHATSAPP - ${sessionId}] Usuário desconectou sessão no aparelho. Dados da sessão removidos.`);
            }
        } else if (connection === 'open') {
            console.log(`\n✅ [WHATSAPP - ${sessionId}] Conexão estabelecida com sucesso!`);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            if (msg.key.fromMe || !msg.message) continue;

            const userId = msg.key.remoteJid;
            const textMessage = msg.message.conversation ||
                msg.message.extendedTextMessage?.text || '';

            const cleanedMessage = textMessage.trim();
            if (!cleanedMessage) continue;

            if (onMessageReceived) {
                const sendMessage = async (text) => {
                    await sock.sendMessage(userId, { text });
                };

                await onMessageReceived(userId, cleanedMessage, sendMessage, sock);
            }
        }
    });

    return sock;
}

module.exports = { connectWhatsApp };