import { drive_v3, google } from "googleapis";

// Folder tujuan ada di My Drive akun pribadi (OAuth), bukan service account.
const DEST_ROOT_FOLDER_ID = "1ynk7sTD_oDcaPvFiBJu1f4GkR-jVWioJ"; // folder "2026" di My Drive akun pribadi

let cachedDrive: drive_v3.Drive | null = null;

export async function getDriveInstance() {
  if (cachedDrive) return cachedDrive;

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );

  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  cachedDrive = google.drive({ version: "v3", auth: oAuth2Client });
  return cachedDrive;
}

function escapeForQuery(name: string): string {
  return name.replace(/'/g, "\\'");
}

// Ambil file/folder ID dari berbagai format link Google Drive.
function extractDriveId(url: string): string | null {
  const patterns = [/\/folders\/([a-zA-Z0-9_-]+)/, /\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Cari folder dengan nama PERSIS di dalam parent, kalau tidak ada -> buat baru.
// Dipakai untuk folder kota DAN sekarang juga untuk folder kos (supaya tidak duplikat "(2)", "(3)").
async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escapeForQuery(name)}'`;
  const res = await drive.files.list({ q, fields: "files(id, name)", spaces: "drive" });
  const existing = res.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Gagal membuat folder "${name}"`);
  return created.data.id;
}

// Ambil daftar NAMA file (bukan folder) yang sudah ada langsung di dalam folder tertentu.
// Dipakai untuk cek duplikat sebelum copy, supaya file yang sudah ada tidak ditimpa/digandakan.
async function getExistingFileNames(drive: drive_v3.Drive, folderId: string): Promise<Set<string>> {
  const names = new Set<string>();
  let pageToken: string | undefined;

  do {
    const res: any = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(name)",
      pageToken,
    });

    for (const file of res.data.files || []) {
      if (file.name) names.add(file.name);
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return names;
}

// Copy 1 file ke folder tujuan, lalu return webViewLink hasil copy-nya.
async function copyFileIntoFolder(drive: drive_v3.Drive, fileId: string, destFolderId: string): Promise<string | null> {
  const copied = await drive.files.copy({
    fileId,
    requestBody: { parents: [destFolderId] },
    fields: "id, webViewLink",
  });
  return copied.data.webViewLink || (copied.data.id ? `https://drive.google.com/file/d/${copied.data.id}/view` : null);
}

// Salin ISI folder sumber (rekursif, termasuk subfolder) ke folder tujuan.
// File yang namanya SUDAH ADA di folder tujuan akan DILEWATI (tidak ditimpa, tidak digandakan).
async function copyFolderContentsRecursive(
  drive: drive_v3.Drive,
  sourceFolderId: string,
  destFolderId: string,
  collectedLinks: string[],
  skippedDuplicates: string[],
) {
  // Ambil daftar nama file yang sudah ada di folder tujuan SEKALI di awal,
  // lalu update terus di memori selama loop supaya file duplikat dalam 1 batch juga kedeteksi.
  const existingNames = await getExistingFileNames(drive, destFolderId);

  let pageToken: string | undefined;

  do {
    const res: any = await drive.files.list({
      q: `'${sourceFolderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageToken,
    });

    for (const file of res.data.files || []) {
      if (!file.id) continue;

      if (file.mimeType === "application/vnd.google-apps.folder") {
        // Subfolder: cari/reuse folder dengan nama sama di tujuan, lalu rekursif ke dalamnya.
        const subFolderId = await findOrCreateFolder(drive, file.name || "Untitled", destFolderId);
        await copyFolderContentsRecursive(drive, file.id, subFolderId, collectedLinks, skippedDuplicates);
        continue;
      }

      const fileName = file.name || "Untitled";

      if (existingNames.has(fileName)) {
        // Sudah ada file dengan nama sama di folder tujuan -> lewati, jangan timpa/gandakan.
        skippedDuplicates.push(fileName);
        continue;
      }

      const link = await copyFileIntoFolder(drive, file.id, destFolderId);
      if (link) {
        collectedLinks.push(link);
        existingNames.add(fileName); // supaya tidak ke-copy dobel kalau ada nama sama dalam batch ini juga
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
}

export interface CopyKosPhotosResult {
  folderUrl: string;
  fileLinks: string[];
  copiedCount: number;
  skippedLinks: string[];
  skippedDuplicates: string[]; // nama file yang dilewati karena sudah ada di folder tujuan
}

// Entry point utama: dipanggil dari kosActions.ts
// Struktur tujuan: DEST_ROOT_FOLDER_ID / <namaKota> / <namaKos>
// Folder kos di-REUSE kalau sudah ada (tidak bikin "(2)", "(3)" lagi),
// dan file yang sudah ada di dalamnya (nama sama) dilewati, tidak ditimpa.
export async function copyKosPhotosToDrive(
  gdriveLinksText: string,
  namaKota: string,
  namaKos: string,
): Promise<CopyKosPhotosResult | null> {
  const links = gdriveLinksText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (links.length === 0) return null;

  const drive = await getDriveInstance();

  const kotaFolderId = await findOrCreateFolder(drive, namaKota, DEST_ROOT_FOLDER_ID);
  const destFolderId = await findOrCreateFolder(drive, namaKos, kotaFolderId);

  let copiedCount = 0;
  const skippedLinks: string[] = [];
  const skippedDuplicates: string[] = [];
  const fileLinks: string[] = [];

  // Nama file yang sudah ada langsung di folder kos ini (untuk link yang berupa file tunggal, bukan folder).
  const existingNamesAtRoot = await getExistingFileNames(drive, destFolderId);

  for (const link of links) {
    const fileId = extractDriveId(link);
    if (!fileId) {
      skippedLinks.push(link);
      continue;
    }

    try {
      const meta = await drive.files.get({ fileId, fields: "id, name, mimeType" });

      if (meta.data.mimeType === "application/vnd.google-apps.folder") {
        await copyFolderContentsRecursive(drive, fileId, destFolderId, fileLinks, skippedDuplicates);
      } else {
        const fileName = meta.data.name || "Untitled";

        if (existingNamesAtRoot.has(fileName)) {
          skippedDuplicates.push(fileName);
        } else {
          const copiedLink = await copyFileIntoFolder(drive, fileId, destFolderId);
          if (copiedLink) {
            fileLinks.push(copiedLink);
            existingNamesAtRoot.add(fileName);
          }
        }
      }
      copiedCount++;
    } catch (err: any) {
      const reason = err?.response?.data?.error?.message || err?.message || "unknown error";
      console.error(`Gagal menyalin link "${link}" (fileId: ${fileId}): ${reason}`);
      skippedLinks.push(link);
    }
  }

  return {
    folderUrl: `https://drive.google.com/drive/folders/${destFolderId}`,
    fileLinks,
    copiedCount,
    skippedLinks,
    skippedDuplicates,
  };
}
