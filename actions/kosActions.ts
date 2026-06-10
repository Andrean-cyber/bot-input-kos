'use server';

import { google } from 'googleapis';
import { v2 as cloudinary } from 'cloudinary';
import { parseChatKos } from '@/utils/parser';

const SPREADSHEET_ID = '1Nc-TdrO-NqXF7FgkaY1JWAezyFfImImLYfLzf0gfmV0';

// Fungsi helper untuk inisialisasi Google Sheets
async function getSheetsInstance() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function uploadAndSaveKos(formData: FormData) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const chatTemplate = formData.get('chatTemplate') as string;
    const files = formData.getAll('images') as File[];

    if (!chatTemplate) throw new Error('Template chat tidak boleh kosong!');

    const parsedData = parseChatKos(chatTemplate);
    const namaKos = parsedData.NAMA_KOS || 'Kos Tanpa Nama';
    const namaKota = parsedData.KOTA || 'Surabaya'; 

    // 1. UPLOAD FOTO BARU (Jika Ada)
    const imageUrls: string[] = [];
    for (const file of files) {
      if (file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadResult = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: `bot-kos/${namaKota}/${namaKos}`, resource_type: 'image' },
            (error, result) => { if (error) reject(error); else resolve(result); }
          ).end(buffer);
        });
        if (uploadResult?.secure_url) imageUrls.push(uploadResult.secure_url);
      }
    }

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
      // JIKA DATA SUDAH ADA (UPDATE MODE) - Spasi typo sudah diperbaiki di sini
      const rowDataLama = kosRows[existingKosIndex];
      idKos = rowDataLama[0]; // Pakai ID lama
      tanggalPembuatan = rowDataLama[11]; // Pertahankan tanggal dibuat
      
      // Jika tidak upload foto baru, pakai foto lama. Jika ada yang baru, gabungkan.
      const fotoLama = rowDataLama[10] || '';
      if (imageUrls.length === 0) {
        fotoFinal = fotoLama;
      } else {
        fotoFinal = fotoLama ? `${fotoLama}, ${imageUrls.join(', ')}` : imageUrls.join(', ');
      }
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

    return rows.slice(1).map(row => ({
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
      foto: row[10] ? row[10].split(', ') : [],
      updatedAt: row[12]
    }));
  } catch (error) {
    console.error("Gagal mengambil data pencarian:", error);
    return [];
  }
}