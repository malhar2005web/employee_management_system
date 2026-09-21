import jwt from 'jsonwebtoken';
import { ENV_VARS } from '../config/envVars.js';

export const generateTokenAndSetCookie = (userId, res, extraPayload = {}) => {
    const token = jwt.sign({ userId, ...extraPayload }, ENV_VARS.JWT_SECRET, { expiresIn: '30d' });
    
    res.cookie("jwt-moma", token, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: ENV_VARS.NODE_ENV !== "development",
    });
    return token;
};
