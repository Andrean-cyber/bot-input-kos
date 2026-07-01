"use server";

import { google } from "googleapis";
import { parseChatKos, JENIS_VALID } from "@/utils/parser";

const SPREADSHEET_ID = "1v-55v7jXKlHM1WUWRvwes68FnfjN2hBu0knH2LCwy4s";

// Index kolom: 0=NO 1=Nama Kos 2=Jenis 3=Tanggal Input 4=Alamat 5=Nomor 6=Fasilitas 7=Harga 8=Foto 9=Ket
const HEADER = ["NO", "Nama Kos", "Jenis", "Tanggal Input", "Alamat", "Nomor", "Fasilitas", "Harga", "Foto", "Ket"];

// Sheet-sheet non-kota yang tidak boleh ikut ditampilkan/diproses sebagai data kos
const EXCLUDED_SHEETS = ["MASTER", "MASTERPIECE / HIDDEN GEM", "MITRA / ENDORSE", "MITRA", "MoU", "Malang Lama"];

function isExcludedSheet(title: string): boolean {
  return EXCLUDED_SHEETS.some((excluded) => excluded.toLowerCase() === title.toLowerCase());
}

const LEFT_ALIGN_COLUMNS = [1, 4, 6, 8, 9]; // Nama Kos, Alamat, Fasilitas, Foto, Ket
const WRAP_COLUMNS = [1, 4, 6, 7, 8, 9];

const NO_COLUMN_WIDTH = 50;
const UNIFORM_COLUMN_WIDTH = 160;
const WIDE_COLUMN_WIDTH = 300;
const UNIFORM_ROW_HEIGHT = 40;

const HEADER_BG_COLOR = { red: 0.18, green: 0.36, blue: 0.69 };
const HEADER_TEXT_COLOR = { red: 1, green: 1, blue: 1 };

function extractFolderId(url: string): string | null {
  const patterns = [/folders\/([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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

    const response = await drive.files.get({ fileId: folderId, fields: "name" });
    return response.data.name || "Folder Tanpa Nama";
  } catch (error) {
    console.error("Gagal mengambil nama folder:", folderUrl, error);
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

// Validasi struktur header sebuah sheet supaya hanya sheet kos asli (HEADER yang cocok)
// yang dianggap sebagai "sheet kota". Sheet lain (log, rekap, dsb) otomatis di-skip
// walau namanya tidak ada di EXCLUDED_SHEETS.
async function isValidKosSheet(sheets: any, title: string): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:J1`,
    });
    const headerRow = response.data.values?.[0] || [];

    return (
      headerRow[0]?.trim() === "NO" &&
      headerRow[1]?.trim() === "Nama Kos" &&
      headerRow[2]?.trim() === "Jenis"
    );
  } catch (error) {
    console.error(`Gagal validasi header sheet "${title}":`, error);
    return false;
  }
}

async function getValidKotaTitles(sheets: any): Promise<string[]> {
  const allTitles = await getAllSheetTitles(sheets);
  const candidateTitles = allTitles.filter((title) => !isExcludedSheet(title));

  const validityChecks = await Promise.all(candidateTitles.map((t) => isValidKosSheet(sheets, t)));

  return candidateTitles.filter((_, i) => validityChecks[i]);
}

async function getSheetIdByTitle(sheets: any, title: string): Promise<number | null> {
  const allSheets = await getAllSheetsMeta(sheets);
  const sheet = allSheets.find((s: any) => s.properties.title === title);
  return sheet ? sheet.properties.sheetId : null;
}

async function styleNewSheet(sheets: any, sheetId: number, numColumns: number) {
  const jenisColIndex = 2;

  const requests: any[] = [
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: NO_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: numColumns },
        properties: { pixelSize: UNIFORM_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 2000 },
        properties: { pixelSize: UNIFORM_ROW_HEIGHT },
        fields: "pixelSize",
      },
    },
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
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: numColumns },
        cell: {
          userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "CLIP" },
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
  ];

  WRAP_COLUMNS.filter((col) => col < numColumns).forEach((colIndex) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: colIndex, endIndex: colIndex + 1 },
        properties: { pixelSize: WIDE_COLUMN_WIDTH },
        fields: "pixelSize",
      },
    });
  });

  LEFT_ALIGN_COLUMNS.forEach((colIndex) => {
    if (colIndex < numColumns) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          cell: { userEnteredFormat: { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "CLIP" } },
          fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      });
    }
  });

  WRAP_COLUMNS.filter((col) => col < numColumns).forEach((colIndex) => {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
        cell: { userEnteredFormat: { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    });
  });

  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2000, startColumnIndex: jenisColIndex, endColumnIndex: jenisColIndex + 1 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: JENIS_VALID.map((v) => ({ userEnteredValue: v })) },
        showCustomUi: true,
        strict: false,
      },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
}

async function ensureSheetExists(sheets: any, title: string): Promise<boolean> {
  const existingTitles = await getAllSheetTitles(sheets);
  if (existingTitles.includes(title)) return false;

  const addSheetResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADER] },
  });

  if (newSheetId !== undefined && newSheetId !== null) {
    await styleNewSheet(sheets, newSheetId, HEADER.length);
  }

  return true;
}

async function upsertRowToSheet(sheets: any, sheetTitle: string, rowDataWithoutNo: string[], namaKos: string): Promise<{ isUpdate: boolean }> {
  const range = `${sheetTitle}!A:J`;
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });

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

    if (!namaKota) {
      throw new Error("Kota tidak terdeteksi! Pastikan tag [KOTA] diisi.");
    }

    if (isExcludedSheet(namaKota)) {
      throw new Error(`Nama kota "${namaKota}" tidak valid karena bentrok dengan sheet sistem.`);
    }

    const imageUrls = gdriveLinksText.split("\n").map((link) => link.trim()).filter(Boolean);
    const fotoUrl = imageUrls.join(", ");

    const sheets = await getSheetsInstance();

    const sheetIsNew = await ensureSheetExists(sheets, namaKota);

    // Urutan: Nama Kos, Jenis, Tanggal Input, Alamat, Nomor, Fasilitas, Harga, Foto, Ket
    const rowData = [
      namaKos,
      parsedData.JENIS,
      parsedData.TANGGAL_INPUT,
      parsedData.ALAMAT,
      "'" + parsedData.CP,
      parsedData.FASILITAS,
      parsedData.HARGA,
      fotoUrl,
      parsedData.NEARBY,
    ];

    const result = await upsertRowToSheet(sheets, namaKota, rowData, namaKos);

    let message = `Data Kos "${namaKos}" ${result.isUpdate ? "BERHASIL DIUPDATE" : "BERHASIL DISIMPAN"} di sheet "${namaKota}"`;
    if (sheetIsNew) {
      message += ` (sheet kota baru otomatis dibuat & diformat)`;
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
    const kotaTitles = await getValidKotaTitles(sheets);

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
              const fotoRaw = row[8] || "";
              const fotoLinks = fotoRaw.split(",").map((x: string) => x.trim()).filter(Boolean);

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
                foto,
                ket: row[9],
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
    return await getValidKotaTitles(sheets);
  } catch (error) {
    console.error("Gagal mengambil daftar kota:", error);
    return [];
  }
}
