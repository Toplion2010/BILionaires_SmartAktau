# Supabase Storage Setup Instructions

## Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Configure:
   - **Name**: `uploads`
   - **Public**: ✅ Yes (for demo purposes)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp`

## Storage Policies

After creating the bucket, set up these policies:

### 1. Allow Public Uploads (for demo/hackathon)

```sql
-- Allow anyone to upload to the uploads bucket
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');
```

### 2. Allow Public Downloads

```sql
-- Allow anyone to view uploaded files
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');
```

### 3. Allow Delete (optional, for admins only)

```sql
-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');
```

## For Production

For a production deployment, you should:

1. Make the bucket **private** instead of public
2. Use **signed URLs** for secure access to photos
3. Implement server-side upload endpoint using `service_role` key
4. Restrict policies to authenticated users only

Example server-side upload (use in separate Node.js/Express backend):

```javascript
// server/upload.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY // Use service_role for server
)

// Generate signed URL for secure downloads
const { data, error } = await supabase.storage
  .from('uploads')
  .createSignedUrl('path/to/file.jpg', 3600) // 1 hour expiry

console.log(data.signedUrl)
```

## Bucket Structure

Files are organized as:
```
uploads/
  ├── ACT-1234567890/
  │   ├── 1234567890_photo1.jpg
  │   └── 1234567891_photo2.png
  └── ACT-1234567899/
      └── 1234567899_image.webp
```

Each complaint's photos are stored in a folder named after its `public_id`.
