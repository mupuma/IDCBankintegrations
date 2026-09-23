"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 4001);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/payments', (_req, res) => {
    res.status(410).json({
        success: false,
        error: 'ZICB legacy payment API has been removed. Submit payments through the portal H2H ledger.',
    });
});
app.get('/health', (_req, res) => {
    res.json({ status: 'disabled', service: 'zicb-legacy-agent-api', replacement: 'zicb-h2h-agent' });
});
app.listen(port, () => {
    console.log(`ZICB legacy payment API is disabled on http://localhost:${port}`);
    console.log('Use npm run dev with ZICB_H2H_ENABLED=true to start the H2H agent.');
});
