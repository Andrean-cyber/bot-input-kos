'use server';

import { google } from 'googleapis';
// import { v2 as cloudinary } from 'cloudinary';
import { parseChatKos } from '@/utils/parser';

const SPREADSHEET_ID = '1Nc-TdrO-NqXF7FgkaY1JWAezyFfImImLYfLzf0gfmV0';
function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function getFolderName(folderUrl: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({
      version: 'v3',
      auth
    });

    const folderId = extractFolderId(folderUrl);

    if (!folderId) return 'Folder Tidak Diketahui';

    const response = await drive.files.get({
      fileId: folderId,
      fields: 'name'
    });

    return response.data.name || 'Folder Tanpa Nama';
  } catch (error) {
    console.error('Gagal mengambil nama folder:', error);
    return 'Folder Tidak Diketahui';
  }
}

// Fungsi helper untuk inisialisasi Google Sheets
async function getSheetsInstance() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
  });
  return google.sheets({ version: 'v4', auth });
}

// Helper untuk mengambil sheetId numerik berdasarkan nama sheet
async function getSheetIdByTitle(sheets: any, title: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });

  const sheet = meta.data.sheets?.find(
    (s: any) => s.properties.title === title
  );

  if (!sheet) {
    throw new Error(`Sheet "${title}" tidak ditemukan di spreadsheet.`);
  }

  return sheet.properties.sheetId;
}

// Helper untuk menerapkan format rata tengah + auto wrap pada sebuah sheet
async function applyCellFormatting(
  sheets: any,
  sheetTitle: string,
  numColumns: number
) {
  try {
    const sheetId = await getSheetIdByTitle(sheets, sheetTitle);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1, // skip baris header (index 0)
                startColumnIndex: 0,
                endColumnIndex: numColumns,
                // endRowIndex sengaja tidak diisi -> berlaku untuk semua baris
                // ke bawah, jadi baris baru ke depannya otomatis ikut rapi
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields:
                'userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
        ],
      },
    });
  } catch (error) {
    // Format gagal bukan error fatal, jadi cukup di-log saja
    console.error(`Gagal menerapkan format pada sheet "${sheetTitle}":`, error);
  }
}

export async function uploadAndSaveKos(formData: FormData) {
  try {
    // cloudinary.config({
    //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    //   api_key: process.env.CLOUDINARY_API_KEY,
    //   api_secret: process.env.CLOUDINARY_API_SECRET,
    // });

    const chatTemplate = formData.get('chatTemplate') as string;
    // const files = formData.getAll('images') as File[];
    const gdriveLinksText =
      (formData.get('gdriveLinks') as string) || '';

    if (!chatTemplate) throw new Error('Template chat tidak boleh kosong!');

    const parsedData = parseChatKos(chatTemplate);
    const namaKos = parsedData.NAMA_KOS || 'Kos Tanpa Nama';
    const namaKota = parsedData.KOTA || 'Surabaya'; 

    // Ambil link Google Drive yang dipisahkan per baris
    const imageUrls = gdriveLinksText
      .split('\n')
      .map(link => link.trim())
      .filter(Boolean);

    const sheets = await getSheetsInstance();
    const tanggalSekarang = new Date().toLocaleDateString('id-ID');

    // 2. CEK DUPLIKASI DI DATA_KOS
    const kosResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DATA_KOS!A:M',
    });
    const kosRows = kosResponse.data.values || [];
    
    // Cari index berdasarkan Nama Kos (Kolom B / Index 1)
    const existingKosIndex = kosRows.findIndex(
      row => row[1] && row[1].toLowerCase().trim() === namaKos.toLowerCase().trim()
    );

    let idKos = 'KOS-' + Date.now();
    let tanggalPembuatan = tanggalSekarang;
    let fotoFinal = imageUrls.join(', ');
    let isUpdate = false;

    if (existingKosIndex !== -1) {
      const rowDataLama = kosRows[existingKosIndex];
      idKos = rowDataLama[0];
      tanggalPembuatan = rowDataLama[11];

      const fotoLama = rowDataLama[10] || '';

      fotoFinal =
        imageUrls.length > 0
          ? imageUrls.join(', ')
          : fotoLama;

      isUpdate = true;
    }

    const dataKosRow = [
      idKos, namaKos, namaKota, parsedData.JENIS, 'Aktif',
      parsedData.ALAMAT, parsedData.CP, parsedData.FASILITAS,
      parsedData.FASILITAS_UMUM, parsedData.NEARBY, fotoFinal,
      tanggalPembuatan, tanggalSekarang
    ];

    if (isUpdate) {
      // Update baris yang sama di Google Sheets
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `DATA_KOS!A${existingKosIndex + 1}:M${existingKosIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [dataKosRow] }
      });
    } else {
      // Tambah baru di paling bawah
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DATA_KOS!A:M',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [dataKosRow] }
      });
    }

    // 3. PROSES DATA KAMAR (Mencegah Duplikasi Kamar)
    const kamarResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DATA_KAMAR!A:D',
    });
    const semuaKamar = kamarResponse.data.values || [];
    
    // Filter & buang semua kamar lama milik ID Kos ini agar tidak duplikat
    const kamarSisa = semuaKamar.filter(row => row[0] !== idKos);

    // Parsing data kamar baru dari chat
    const barisKamarChat = parsedData.KAMAR.split(/\r?\n/).filter(line => line.trim() !== '');
    const dataKamarBaru = barisKamarChat.map((baris, index) => {
      const [typeKamar, harga] = baris.split('|').map(s => s.trim());
      return [
        idKos,
        `${idKos}-KAMAR-${index + 1}`,
        typeKamar,
        harga ? parseInt(harga, 10) : ''
      ];
    });

    // Gabungkan data kamar sisa dengan kamar hasil update terbaru
    const totalKamarLengkap = [...kamarSisa, ...dataKamarBaru];

    // Tulis ulang Sheet DATA_KAMAR dengan data yang bersih
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: 'DATA_KAMAR!A:D' });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DATA_KAMAR!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: totalKamarLengkap }
    });

    // 4. RAPIKAN TAMPILAN: rata tengah + auto wrap di kedua sheet
    await applyCellFormatting(sheets, 'DATA_KOS', 13);   // kolom A:M = 13 kolom
    await applyCellFormatting(sheets, 'DATA_KAMAR', 4);  // kolom A:D = 4 kolom

    return { 
      success: true, 
      message: isUpdate 
        ? `Data Kos "${namaKos}" BERHASIL DIUPDATE beserta data kamarnya!` 
        : `Data Kos Baru "${namaKos}" Berhasil disimpan!` 
    };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message || 'Terjadi kesalahan sistem.' };
  }
}

// FUNGSI SELEKSI PENCARIAN
export async function getAllKos() {
  try {
    const sheets = await getSheetsInstance();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DATA_KOS!A:M',
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) return [];

    return await Promise.all(
      rows.slice(1).map(async (row: string[]) => {

        const fotoLinks = row[10]
          ? row[10]
              .split(',')
              .map((x: string) => x.trim())
              .filter(Boolean)
          : [];

        const foto = await Promise.all(
          fotoLinks.map(async (link: string) => ({
            url: link,
            name: await getFolderName(link)
          }))
        );

        return {
          idKos: row[0],
          namaKos: row[1],
          kota: row[2],
          jenis: row[3],
          status: row[4],
          alamat: row[5],
          cp: row[6],
          fasilitas: row[7],
          fasilitasUmum: row[8],
          nearby: row[9],
          foto,
          updatedAt: row[12]
        };
      })
    );

  } catch (error) {
    console.error('Gagal mengambil data pencarian:', error);
    return [];
  }
}
