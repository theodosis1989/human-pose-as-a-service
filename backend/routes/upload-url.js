// routes/upload-url.js
import 'dotenv/config'; // MUST be before any other imports
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = express.Router();

console.log('Supabase URL:', process.env.SUPABASE_URL);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3 = new AWS.S3({ region: "eu-north-1" });

router.get('/', async (req, res) => {
  try {
    const allowAnon = String(process.env.ALLOW_ANON_UPLOAD_URLS).toLowerCase() === 'true';

    let userId;

    if (!allowAnon) {
      // --- normal auth path ---
      const token = req.headers.authorization?.split('Bearer ')[1];
      if (!token) return res.status(401).json({ error: 'Missing token' });

      const { data, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !data?.user) return res.status(401).json({ error: 'Invalid token' });
      userId = data.user.id;

      // optional: quota check here (keep as-is if you already have it)
      // ...
    } else {
      // --- dev-only anonymous path ---
      userId = 'dev-user';
    }

    // Build upload intent
    const key = `uploads/${userId}/${uuidv4()}.mp4`;
    const jti = uuidv4();
    const exp = Math.floor(Date.now() / 1000) + 5 * 60;

    const payload = `${userId}:${key}:${jti}:${exp}`;
    const sig = crypto
      .createHmac('sha256', process.env.UPLOAD_SIGNING_SECRET)
      .update(payload)
      .digest('hex');

    const uploadUrl = s3.getSignedUrl('putObject', {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Expires: 300,
      ContentType: 'video/mp4',
      IfNoneMatch: '*',
      Metadata: { 'user-id': userId, jti, exp: String(exp), sig },
    });

    return res.json({
      uploadUrl,
      key,
      requiredHeaders: {
        'x-amz-meta-user-id': userId,
        'x-amz-meta-jti': jti,
        'x-amz-meta-exp': String(exp),
        'x-amz-meta-sig': sig,
        'Content-Type': 'video/mp4',
        'If-None-Match': '*',
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;