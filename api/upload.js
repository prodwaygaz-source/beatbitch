// ให้แอดมินอัปโหลดไฟล์ใหญ่ (เสียง/ปก) ตรงจากเบราว์เซอร์ไป Vercel Blob (เลี่ยงลิมิต body 4.5MB ของ serverless)
const { handleUpload } = require('@vercel/blob/client');
const { requireAdmin } = require('../lib/auth');
module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json(await handleUpload({
      body: req.body, request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['audio/*', 'image/*'], maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true
      }),
      onUploadCompleted: async () => {}
    }));
  } catch (e) { res.status(400).json({ error: e.message }); }
};
