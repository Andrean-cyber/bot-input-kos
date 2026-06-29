export interface ParsedKos {
  KOTA: string;
  KATEGORI: string; // '' | 'Endorse/Mitra' | 'Endorse' | 'Mitra' | 'MoU'
  NAMA_KOS: string;
  JENIS: string; // '' | 'Putra' | 'Putri' | 'Campur' | 'Putra/Putri' | 'LV'
  TANGGAL_INPUT: string; // DD/MM/YYYY
  ALAMAT: string;
  NEARBY: string;
  HARGA: string;
  FASILITAS: string;
  KAMAR_KOSONG: string;
  CP: string;
}

// Daftar kategori valid (nama sheet kategori, harus match persis nama sheet di Google Sheets)
export const KATEGORI_VALID = ['Endorse/Mitra', 'Endorse', 'Mitra', 'MoU'];

// Daftar jenis kos valid (dipakai juga sebagai opsi dropdown data-validation di Google Sheets)
export const JENIS_VALID = ['Putra', 'Putri', 'Campur', 'Putra/Putri', 'LV'];

// Normalisasi teks kategori dari input bebas (misal "endorse", "MOU", "endorse / mitra")
// menjadi nama kategori baku yang sesuai dengan nama sheet.
export function normalizeKategori(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '');

  if (cleaned === 'endorse') return 'Endorse';
  if (cleaned === 'mitra') return 'Mitra';
  if (cleaned === 'mou') return 'MoU';
  if (
    cleaned === 'endorse/mitra' ||
    cleaned === 'mitra/endorse' ||
    cleaned === 'endorse-mitra' ||
    cleaned === 'mitra-endorse'
  ) {
    return 'Endorse/Mitra';
  }

  return '';
}

// Normalisasi teks JENIS dari input bebas (tag [JENIS]) ke salah satu dari JENIS_VALID.
// Mengembalikan '' jika tidak cocok dengan opsi manapun (akan lanjut ke auto-detect).
export function normalizeJenis(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '');

  if (cleaned === 'putra') return 'Putra';
  if (cleaned === 'putri') return 'Putri';
  if (cleaned === 'campur' || cleaned === 'mix') return 'Campur';
  if (cleaned === 'putra/putri' || cleaned === 'putri/putra' || cleaned === 'putra-putri') {
    return 'Putra/Putri';
  }
  if (cleaned === 'lv') return 'LV';

  return '';
}

// Deteksi otomatis JENIS dari teks (biasanya nama kos / alamat) jika tag [JENIS] tidak diisi
// atau tidak cocok dengan salah satu opsi JENIS_VALID.
// Catatan: 'LV' tidak punya kata kunci alami untuk dideteksi otomatis, jadi harus diisi
// manual lewat tag [JENIS] jika dibutuhkan.
export function detectJenis(text: string): string {
  const lower = text.toLowerCase();
  const hasPutra = /\bputra\b/.test(lower);
  const hasPutri = /\bputri\b/.test(lower);
  const hasCampur = /\bcampur\b|\bcowok\s*cewek\b|\bmix\b/.test(lower);

  if (hasCampur) return 'Campur';
  if (hasPutra && hasPutri) return 'Putra/Putri';
  if (hasPutri) return 'Putri';
  if (hasPutra) return 'Putra';
  return '';
}

// Validasi & normalisasi tanggal format DD/MM/YYYY.
// Mengembalikan tanggal hari ini (zero-padded DD/MM/YYYY) jika input kosong atau tidak valid.
function getTodayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function normalizeTanggalInput(raw: string): { value: string; isFallback: boolean } {
  const today = getTodayFormatted();

  if (!raw || !raw.trim()) {
    return { value: today, isFallback: false }; // kosong itu wajar, bukan error
  }

  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return { value: today, isFallback: true }; // format salah -> fallback + warning
  }

  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { value: today, isFallback: true };
  }

  const paddedDay = dd.padStart(2, '0');
  const paddedMonth = mm.padStart(2, '0');
  return { value: `${paddedDay}/${paddedMonth}/${yyyy}`, isFallback: false };
}

export function parseChatKos(text: string): ParsedKos & { tanggalIsFallback?: boolean } {
  const tags: { key: keyof ParsedKos; labels: string[] }[] = [
    { key: 'KOTA', labels: ['KOTA'] },
    { key: 'KATEGORI', labels: ['KATEGORI'] },
    { key: 'NAMA_KOS', labels: ['NAMA KOS', 'NAMA_KOS'] },
    { key: 'JENIS', labels: ['JENIS'] },
    { key: 'TANGGAL_INPUT', labels: ['TANGGAL INPUT', 'TANGGAL_INPUT'] },
    { key: 'ALAMAT', labels: ['ALAMAT'] },
    { key: 'NEARBY', labels: ['NEARBY'] },
    { key: 'HARGA', labels: ['HARGA'] },
    { key: 'FASILITAS', labels: ['FASILITAS'] },
    { key: 'KAMAR_KOSONG', labels: ['KAMAR KOSONG', 'KAMAR_KOSONG'] },
    { key: 'CP', labels: ['CP'] },
  ];

  const data: any = {};

  tags.forEach(({ key, labels }) => {
    let matchedValue = '';

    for (const label of labels) {
      // Kebal terhadap spasi berlebih dan line break Windows/Mac
      const regex = new RegExp(
        `\\[${label}\\]\\s*\\r?\\n?([\\s\\S]*?)(?=\\r?\\n\\s*\\[|$)`,
        'i'
      );
      const match = text.match(regex);

      if (match) {
        matchedValue = match[1].trim();
        break;
      }
    }

    data[key] = matchedValue;
  });

  // Normalisasi kategori ke nama baku
  data.KATEGORI = normalizeKategori(data.KATEGORI);

  // Normalisasi JENIS ke salah satu opsi baku; jika tidak cocok/kosong, auto-deteksi dari teks
  const jenisNormalized = normalizeJenis(data.JENIS);
  data.JENIS = jenisNormalized || detectJenis(data.NAMA_KOS + ' ' + data.ALAMAT);

  // Validasi & fallback TANGGAL_INPUT
  const tanggalResult = normalizeTanggalInput(data.TANGGAL_INPUT);
  data.TANGGAL_INPUT = tanggalResult.value;
  data.tanggalIsFallback = tanggalResult.isFallback;

  return data as ParsedKos & { tanggalIsFallback?: boolean };
}
