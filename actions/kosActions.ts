"use server";

import { google } from "googleapis";
import { parseChatKos, KATEGORI_VALID, JENIS_VALID } from "@/utils/parser";

const SPREADSHEET_ID = "1Nc-TdrO-NqXF7FgkaY1JWAezyFfImImLYfLzf0gfmV0";

// Header untuk sheet KOTA (10 kolom, tanpa "Kamar Kosong")
// Index kolom: 0=NO 1=Nama Kos 2=Jenis 3=Tanggal Input 4=Alamat 5=Nomor 6=Fasilitas 7=Harga 8=Nearby 9=Folder Drive URL
const HEADER_KOTA = ["NO", "Nama Kos", "Jenis", "Tanggal Input", "Alamat", "Nomor", "Fasilitas", "Harga", "Nearby", "FOLDER DRIVE URL"];

// Header untuk sheet KATEGORI (12 kolom, + "Kamar Kosong" + "Kategori")
const HEADER_KATEGORI = ["NO", "Nama Kos", "Jenis", "Tanggal Input", "Alamat", "Nomor", "Fasilitas", "Harga", "Nearby", "FOLDER DRIVE URL", "Kamar Kosong", "Kategori"];

// Kolom dengan teks panjang -> rata kiri
const LEFT_ALIGN_COLUMNS = [1, 4, 6, 8, 9]; // Nama Kos, Alamat, Fasilitas, Nearby, Folder Drive URL

// Kolom dengan teks sangat panjang -> wrap ke bawah + lebar 200px
const WRAP_COLUMNS = [1, 4, 6, 7, 8, 9]; // Alamat, Fasilitas, Harga, Nearby, FOLDER DRIVE URL

const NO_COLUMN_WIDTH = 50; // px, khusus kolom NO
const UNIFORM_COLUMN_WIDTH = 160; // px, kolom standar
const WIDE_COLUMN_WIDTH = 300; // px, kolom teks panjang (Alamat, Fasilitas, Nearby)
const UNIFORM_ROW_HEIGHT = 40; // px, semua baris

const HEADER_BG_COLOR = { red: 0.18, green: 0.36, blue: 0.69 }; // biru
const HEADER_TEXT_COLOR = { red: 1, green: 1, blue: 1 }; // putih

function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function getFolderName(folderUrl: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });
    const folderId = extractFolderId(folderUrl);

    if (!folderId) return "Folder Tidak Diketahui";

    const response = await drive.files.get({
      fileId: folderId,
      fields: "name",
    });

    return response.data.name || "Folder Tanpa Nama";
  } catch (error) {
    console.error("Gagal mengambil nama folder:", error);
    return "Folder Tidak Diketahui";
  }
}

async function getSheetsInstance() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getAllSheetsMeta(sheets: any) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  return meta.data.sheets || [];
}

async function getAllSheetTitles(sheets: any): Promise<string[]> {
  const allSheets = await getAllSheetsMeta(sheets);
  return allSheets.map((s: any) => s.properties.title);
}

async function getSheetIdByTitle(sheets: any, title: string): Promise<number | null> {
  const allSheets = await getAllSheetsMeta(sheets);
  const sheet = allSheets.find((s: any) => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

async function styleNewSheet(sheets: any, sheetId: number, numColumns: number) {
  const jenisColIndex = 2;

  // Mulai dengan block-block yang bisa langsung masuk array
  const requests: any[] = [
    // Kolom NO: lebar kecil
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: NO_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    },
    // Kolom 1 ke atas: lebar seragam
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: numColumns },
        properties: { pixelSize: UNIFORM_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    },
    // Semua baris: tinggi seragam
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 2000 },
        properties: { pixelSize: UNIFORM_ROW_HEIGHT },
        fields: "pixelSize",
      },
    },
    // Header: bold, center, biru, putih, clip
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numColumns },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG_COLOR,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "CLIP",
            textFormat: { bold: true, foregroundColor: HEADER_TEXT_COLOR },
          },
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)",
      },
    },
    // Freeze baris header
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Body default: tengah + clip
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: numColumns },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "CLIP",
          },
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
  ];

  // Override lebar kolom teks panjang ke WIDE_COLUMN_WIDTH
  WRAP_COLUMNS.filter((col) => col < numColumns).forEach((colIndex) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: colIndex, endIndex: colIndex + 1 },
        properties: { pixelSize: WIDE_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    });
  });

  // Override rata kiri untuk kolom teks panjang
  LEFT_ALIGN_COLUMNS.forEach((colIndex) => {
    if (colIndex < numColumns) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "CLIP",
            },
          },
          fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      });
    }
  });

  // Override WRAP untuk kolom teks sangat panjang (Alamat, Fasilitas, Nearby)
  WRAP_COLUMNS.filter((col) => col < numColumns).forEach((colIndex) => {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            verticalAlignment: "TOP",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    });
  });

  // Dropdown data-validation untuk kolom Jenis
  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: jenisColIndex, endColumnIndex: jenisColIndex + 1 },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: JENIS_VALID.map((v) => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        strict: false,
      },
    },
  });

  // Dropdown data-validation untuk kolom Kategori (index 11, hanya ada di sheet kategori)
  if (numColumns > 11) {
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: 11, endColumnIndex: 12 },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: KATEGORI_VALID.map((v) => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}

async function ensureSheetExists(sheets: any, title: string, header: string[]): Promise<boolean> {
  const existingTitles = await getAllSheetTitles(sheets);

  if (existingTitles.includes(title)) {
    return false;
  }

  const addSheetResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [header] },
  });

  if (newSheetId !== undefined && newSheetId !== null) {
    await styleNewSheet(sheets, newSheetId, header.length);
  }

  return true;
}

async function applyCellFormatting(sheets: any, sheetTitle: string, numColumns: number) {
  try {
    const sheetId = await getSheetIdByTitle(sheets, sheetTitle);
    if (sheetId === null) return;

    const requests: any[] = [
      // Body default: tengah + clip
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: numColumns },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "CLIP",
            },
          },
          fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      },
    ];

    // Override rata kiri
    LEFT_ALIGN_COLUMNS.forEach((colIndex) => {
      if (colIndex < numColumns) {
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: "LEFT",
                verticalAlignment: "MIDDLE",
                wrapStrategy: "CLIP",
              },
            },
            fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        });
      }
    });

    // Override WRAP untuk kolom teks sangat panjang
    WRAP_COLUMNS.forEach((colIndex) => {
      if (colIndex < numColumns) {
        requests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: "LEFT",
                verticalAlignment: "TOP",
                wrapStrategy: "WRAP",
              },
            },
            fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        });

        // Lebar 200px untuk kolom wrap
        requests.push({
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: colIndex, endIndex: colIndex + 1 },
            properties: { pixelSize: WIDE_COLUMN_WIDTH },
            fields: "pixelSize",
          },
        });
      }
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  } catch (error) {
    console.error(`Gagal menerapkan format pada sheet "${sheetTitle}":`, error);
  }
}

async function upsertRowToSheet(sheets: any, sheetTitle: string, range: string, rowDataWithoutNo: string[], namaKos: string): Promise<{ isUpdate: boolean }> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows: string[][] = response.data.values || [];
  const dataRows = rows.slice(1);

  const existingIndex = dataRows.findIndex((row) => row[1] && row[1].toLowerCase().trim() === namaKos.toLowerCase().trim());

  if (existingIndex !== -1) {
    const noLama = dataRows[existingIndex][0];
    const fullRow = [noLama, ...rowDataWithoutNo];
    const actualRowNumber = existingIndex + 2;
    const lastColLetter = String.fromCharCode(65 + fullRow.length - 1);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!A${actualRowNumber}:${lastColLetter}${actualRowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fullRow] },
    });

    return { isUpdate: true };
  } else {
    const newNo = dataRows.length + 1;
    const fullRow = [newNo, ...rowDataWithoutNo];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fullRow] },
    });

    return { isUpdate: false };
  }
}

export async function uploadAndSaveKos(formData: FormData) {
  try {
    const chatTemplate = formData.get("chatTemplate") as string;
    const gdriveLinksText = (formData.get("gdriveLinks") as string) || "";

    if (!chatTemplate) throw new Error("Template chat tidak boleh kosong!");

    const parsedData = parseChatKos(chatTemplate);

    const namaKos = parsedData.NAMA_KOS || "Kos Tanpa Nama";
    const namaKota = (parsedData.KOTA || "").trim();
    const kategori = parsedData.KATEGORI;

    if (!namaKota) {
      throw new Error("Kota tidak terdeteksi! Pastikan tag [KOTA] diisi.");
    }

    const imageUrls = gdriveLinksText
      .split("\n")
      .map((link) => link.trim())
      .filter(Boolean);
    const folderDriveUrl = imageUrls.join(", ");

    const sheets = await getSheetsInstance();

    // 1. Pastikan sheet kota ada
    const sheetKotaIsNew = await ensureSheetExists(sheets, namaKota, HEADER_KOTA);

    const baseRowData = [namaKos, parsedData.JENIS, parsedData.TANGGAL_INPUT, parsedData.ALAMAT, "'" + parsedData.CP, parsedData.FASILITAS, parsedData.HARGA, parsedData.NEARBY, folderDriveUrl];

    // 2. Upsert ke sheet kota (10 kolom)
    const kotaResult = await upsertRowToSheet(sheets, namaKota, `${namaKota}!A:J`, baseRowData, namaKos);

    await applyCellFormatting(sheets, namaKota, HEADER_KOTA.length);

    // 3. Upsert ke sheet kategori jika kategori valid (12 kolom)
    let kategoriResult: { isUpdate: boolean } | null = null;

    if (kategori && KATEGORI_VALID.includes(kategori)) {
      await ensureSheetExists(sheets, kategori, HEADER_KATEGORI);

      const kategoriRowData = [...baseRowData, parsedData.KAMAR_KOSONG, kategori];

      kategoriResult = await upsertRowToSheet(sheets, kategori, `${kategori}!A:L`, kategoriRowData, namaKos);

      await applyCellFormatting(sheets, kategori, HEADER_KATEGORI.length);
    }

    let message = `Data Kos "${namaKos}" ${kotaResult.isUpdate ? "BERHASIL DIUPDATE" : "BERHASIL DISIMPAN"} di sheet "${namaKota}"`;
    if (sheetKotaIsNew) {
      message += ` (sheet kota baru otomatis dibuat & diformat)`;
    }
    if (kategoriResult) {
      message += ` dan juga ${kategoriResult.isUpdate ? "diupdate" : "ditambahkan"} di sheet "${kategori}"`;
    }
    message += ".";

    if (parsedData.tanggalIsFallback) {
      message += " ⚠️ Format [TANGGAL INPUT] tidak valid (harus DD/MM/YYYY), menggunakan tanggal hari ini sebagai gantinya.";
    }

    return { success: true, message };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message || "Terjadi kesalahan sistem." };
  }
}

export async function getAllKos() {
  try {
    const sheets = await getSheetsInstance();
    const allTitles = await getAllSheetTitles(sheets);

    const kotaTitles = allTitles.filter((title) => !KATEGORI_VALID.includes(title));

    const allData = await Promise.all(
      kotaTitles.map(async (kotaTitle) => {
        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${kotaTitle}!A:J`,
          });

          const rows = response.data.values || [];
          if (rows.length <= 1) return [];

          return await Promise.all(
            rows.slice(1).map(async (row: string[]) => {
              const folderUrlRaw = row[9] || "";
              const fotoLinks = folderUrlRaw
                .split(",")
                .map((x: string) => x.trim())
                .filter(Boolean);

              const foto = await Promise.all(
                fotoLinks.map(async (link: string) => ({
                  url: link,
                  name: await getFolderName(link),
                })),
              );

              return {
                idKos: `${kotaTitle}-${row[0]}`,
                no: row[0],
                namaKos: row[1],
                jenis: row[2],
                tanggalInput: row[3],
                alamat: row[4],
                cp: row[5],
                fasilitas: row[6],
                harga: row[7],
                nearby: row[8],
                foto,
                kota: kotaTitle,
              };
            }),
          );
        } catch (err) {
          console.error(`Gagal mengambil data sheet kota "${kotaTitle}":`, err);
          return [];
        }
      }),
    );

    return allData.flat();
  } catch (error) {
    console.error("Gagal mengambil data pencarian:", error);
    return [];
  }
}

export async function getAllKotaSheets(): Promise<string[]> {
  try {
    const sheets = await getSheetsInstance();
    const allTitles = await getAllSheetTitles(sheets);
    return allTitles.filter((title) => !KATEGORI_VALID.includes(title));
  } catch (error) {
    console.error("Gagal mengambil daftar kota:", error);
    return [];
  }
}
