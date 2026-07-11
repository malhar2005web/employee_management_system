import dotenv from "dotenv";
dotenv.config({ path: new URL('../.env', import.meta.url) });

export const ENV_VARS = {
    PORT: process.env.PORT || 5008,
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET,
    PGUSER: process.env.PGUSER,
    PGHOST: process.env.PGHOST,
    PGPASSWORD: process.env.PGPASSWORD,
    PGDATABASE: process.env.PGDATABASE,
    PGPORT: process.env.PGPORT || 5432,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS
};
